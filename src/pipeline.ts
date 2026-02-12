import { fetchTweets } from "./search";
import { annotateEngagement } from "./score";
import { filterByFloor } from "./filter";
import { filterAndReply } from "./filterAndReply";
import { filterAlreadyReplied, markReplied } from "./dedupe";
import { selectByQuota } from "./allocate";
import { createReply } from "./reply";
import { logRepliedTweet } from "./logger";
import {
  resetMetrics,
  setRepliesSent,
  logRunMetrics,
  setTweetsFetched,
  setTweetsAfterFloor,
  setTweetsWithReplies,
  setTweetsDeduped,
} from "./metrics";
import * as fs from "fs";
import * as path from "path";
import { TweetWithReply } from "./types";
import { QUERY_TYPE, ENGAGEMENT_FLOOR, MAX_FETCH_TWEETS } from "./config";

type TweetRunRecord =
  | {
      reply: string;
      author: string;
      status: "success";
      postedTweetId: string;
    }
  | {
      reply: string;
      author: string;
      status: "failed";
      error: string;
    };

type PipelineSummary = {
  logs: string[];
  tweets: Record<string, TweetRunRecord>;
  errors: string[];
  summary: {
    tweetsFound: number;
    afterFloor: number;
    aiReplied: number;
    deduped: number;
    selected: number;
    sent: number;
    failed: number;
  };
  replies: Array<{
    tweetId: string;
    reply: string;
    author: string;
    status: "success" | "failed";
    postedTweetId?: string;
    error?: string;
  }>;
};

export async function runPipelineWithSummary(
  queryPhrase: string
): Promise<PipelineSummary> {
  resetMetrics();

  const run: PipelineSummary = {
    logs: [],
    tweets: {},
    errors: [],
    summary: {
      tweetsFound: 0,
      afterFloor: 0,
      aiReplied: 0,
      deduped: 0,
      selected: 0,
      sent: 0,
      failed: 0,
    },
    replies: [],
  };

  try {
    // 1) Fetch
    console.log(`[${queryPhrase}] Step 1: Fetching tweets`);
    run.logs.push(
      `1) Fetching up to ${MAX_FETCH_TWEETS} tweets for "${queryPhrase}"…`
    );

    const raw = await fetchTweets(queryPhrase, QUERY_TYPE, MAX_FETCH_TWEETS);

    run.logs.push(`   ➡️ fetched ${raw.length} tweets`);
    setTweetsFetched(raw.length);
    run.summary.tweetsFound = raw.length;

    // 2) Dump raw
    console.log(`[${queryPhrase}] Step 2: Dumping fetched tweets to logs`);
    const dumpDir = path.resolve(__dirname, "../logs");
    if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

    const safeName = queryPhrase.replace(/\W+/g, "_");
    const dumpPath = path.join(dumpDir, `raw_fetched_tweets_${safeName}.json`);
    fs.writeFileSync(dumpPath, JSON.stringify(raw, null, 2), "utf-8");
    run.logs.push(`   🔍 dumped raw tweets to ${dumpPath}`);

    // 3) Score
    console.log(`[${queryPhrase}] Step 3: Annotating engagement`);
    run.logs.push("2) Annotating engagement…");
    let scored = annotateEngagement(raw);

    // 4) Floor
    console.log(`[${queryPhrase}] Step 4: Applying engagement floor`);
    run.logs.push(`3) Applying engagement floor (≥${ENGAGEMENT_FLOOR})…`);
    scored = filterByFloor(scored);
    run.logs.push(`   ➡️ ${scored.length} tweets passed the engagement floor`);
    setTweetsAfterFloor(scored.length);
    run.summary.afterFloor = scored.length;

    // Helpful early exit log
    if (scored.length === 0) {
      console.log(
        `[${queryPhrase}] No tweets passed engagement floor (≥${ENGAGEMENT_FLOOR}).`
      );
    }

    // 5) LLM select + draft replies
    console.log(`[${queryPhrase}] Step 5: AI reply filtering`);
    run.logs.push("4) Relevance check & AI-generated replies…");

    const withReplies: TweetWithReply[] = await filterAndReply(
      scored,
      queryPhrase
    );

    run.logs.push(`   ➡️ ${withReplies.length} AI-generated replies`);
    setTweetsWithReplies(withReplies.length);
    run.summary.aiReplied = withReplies.length;

    if (withReplies.length === 0) {
      console.log(
        `[${queryPhrase}] AI produced 0 replies. Either prompt is too strict or fetched tweets are irrelevant.`
      );
    }

    // 6) Dedupe
    console.log(`[${queryPhrase}] Step 6: Deduplication`);
    run.logs.push("5) Deduplicating authors & tweets…");
    const deduped = filterAlreadyReplied(withReplies);

    run.logs.push(`   ➡️ ${deduped.length} tweets after deduplication`);
    setTweetsDeduped(deduped.length);
    run.summary.deduped = deduped.length;

    if (withReplies.length > 0 && deduped.length === 0) {
      console.log(
        `[${queryPhrase}] Dedupe removed all candidates. Cooldown may be too high or cache has entries from earlier tests.`
      );
    }

    // 7) Quota select
    console.log(`[${queryPhrase}] Step 7: Quota selection`);
    run.logs.push("6) Selecting by blue/non-blue quota…");
    const toReply = selectByQuota(deduped);

    console.log(
      `[${queryPhrase}] Selected for reply: ${toReply.length} (from deduped=${deduped.length})`
    );

    if (toReply.length > 0) {
      console.log(
        `[${queryPhrase}] Selected tweet IDs: ${toReply
          .map((t) => t.id)
          .join(", ")}`
      );
    } else {
      // extra context when nothing gets selected
      console.log(
        `[${queryPhrase}] Nothing selected. counts: fetched=${raw.length} floor=${scored.length} ai=${withReplies.length} deduped=${deduped.length}`
      );
    }

    run.logs.push(`   ➡️ ${toReply.length} tweets selected for reply`);
    run.summary.selected = toReply.length;

    setRepliesSent(toReply.length);

    // 8) Send
    console.log(`[${queryPhrase}] Step 8: Sending replies`);
    run.logs.push(`7) Sending ${toReply.length} replies…`);

    const replies: PipelineSummary["replies"] = [];

    if (toReply.length === 0) {
      console.log(`[${queryPhrase}] No tweets selected. Skipping send.`);
    }

    for (const tweet of toReply) {
      try {
        console.log(`[${queryPhrase}] Attempting reply for tweet ${tweet.id}`);

        // createReply returns posted tweet id (string)
        const postedId = await createReply(tweet, tweet.reply);

        console.log(
          `[${queryPhrase}] ✅ Posted reply tweet_id=${postedId} (in reply to ${tweet.id})`
        );

        logRepliedTweet(tweet);

        const authorName = tweet.author?.userName ?? "unknown";

        replies.push({
          tweetId: tweet.id,
          reply: tweet.reply,
          author: authorName,
          status: "success",
          postedTweetId: postedId,
        });

        run.tweets[tweet.id] = {
          reply: tweet.reply,
          author: authorName,
          status: "success",
          postedTweetId: postedId,
        };

        run.logs.push(`   ✅ Replied to ${tweet.id} (posted ${postedId})`);
      } catch (err: any) {
        console.log(`[${queryPhrase}] ❌ Failed reply for tweet ${tweet.id}`, err);

        const authorName = tweet.author?.userName ?? "unknown";
        const errorMsg = err instanceof Error ? err.message : String(err);

        replies.push({
          tweetId: tweet.id,
          reply: tweet.reply,
          author: authorName,
          status: "failed",
          error: errorMsg,
        });

        run.tweets[tweet.id] = {
          reply: tweet.reply,
          author: authorName,
          status: "failed",
          error: errorMsg,
        };

        run.errors.push(`   Failed reply to ${tweet.id}: ${errorMsg}`);
      }
    }

    run.summary.sent = replies.filter((r) => r.status === "success").length;
    run.summary.failed = replies.filter((r) => r.status === "failed").length;
    run.replies = replies;

    // 9) Cache mark (only successes)
    console.log(`[${queryPhrase}] Step 9: Saving cache`);

    const successful = toReply.filter(
      (t) => run.tweets[t.id]?.status === "success"
    );

    if (successful.length > 0) {
      run.logs.push("8) Saving cache…");
      markReplied(successful);
      console.log(
        `[${queryPhrase}] Saved cache for ${successful.length} successful replies.`
      );
    } else {
      console.log(`[${queryPhrase}] No successful replies; not saving cache.`);
    }

    // 10) Metrics
    console.log(`[${queryPhrase}] Step 10: Logging metrics`);
    logRunMetrics();

    run.logs.push(`Pipeline complete for "${queryPhrase}"\n`);
    console.log(`[${queryPhrase}] Pipeline complete!`);

    return run;
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    run.errors.push(errorMsg);
    console.log(`[${queryPhrase}] Pipeline error:`, err);
    return run;
  }
}