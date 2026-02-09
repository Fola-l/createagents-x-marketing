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
import { randomDelay } from "./delay";
import {
  QUERY_TYPE,
  ENGAGEMENT_FLOOR,
  MAX_FETCH_TWEETS,
} from "./config";

type PipelineSummary = {
  logs: string[];
  tweets: Record<string, any>;
  errors: string[];
  summary: {
    tweetsFound: number;
    afterFloor: number;
    aiReplied: number;
    deduped: number;
    sent: number;
    failed: number;
  };
  replies: any[];
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
      sent: 0,
      failed: 0,
    },
    replies: [],
  };

  try {
    console.log(`[${queryPhrase}] Step 1: Fetching tweets`);
    run.logs.push(`1) Fetching up to ${MAX_FETCH_TWEETS} tweets for "${queryPhrase}"…`);

    const raw = await fetchTweets(queryPhrase, QUERY_TYPE, MAX_FETCH_TWEETS);
    run.logs.push(`   ➡️ fetched ${raw.length} tweets`);
    setTweetsFetched(raw.length);
    run.summary.tweetsFound = raw.length;

    // Dump raw tweets for this phrase
    console.log(`[${queryPhrase}] Step 2: Dumping fetched tweets to logs`);
    const dumpDir = path.resolve(__dirname, "../logs");
    if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

    const safeName = queryPhrase.replace(/\W+/g, "_");
    const dumpPath = path.join(dumpDir, `raw_fetched_tweets_${safeName}.json`);
    fs.writeFileSync(dumpPath, JSON.stringify(raw, null, 2), "utf-8");
    run.logs.push(`   🔍 dumped raw tweets to ${dumpPath}`);

    console.log(`[${queryPhrase}] Step 3: Annotating engagement`);
    run.logs.push("2) Annotating engagement…");
    let scored = annotateEngagement(raw);

    console.log(`[${queryPhrase}] Step 4: Applying engagement floor`);
    run.logs.push(`3) Applying engagement floor (≥${ENGAGEMENT_FLOOR})…`);
    scored = filterByFloor(scored);
    run.logs.push(`   ➡️ ${scored.length} tweets passed the engagement floor`);
    setTweetsAfterFloor(scored.length);
    run.summary.afterFloor = scored.length;

    console.log(`[${queryPhrase}] Step 5: AI reply filtering`);
    run.logs.push("4) Relevance check & AI-generated replies…");
    const withReplies: TweetWithReply[] = await filterAndReply(scored, queryPhrase);
    run.logs.push(`   ➡️ ${withReplies.length} AI-generated replies`);
    setTweetsWithReplies(withReplies.length);
    run.summary.aiReplied = withReplies.length;

    console.log(`[${queryPhrase}] Step 6: Deduplication`);
    run.logs.push("5) Deduplicating authors & tweets…");
    const deduped = filterAlreadyReplied(withReplies);
    run.logs.push(`   ➡️ ${deduped.length} tweets after deduplication`);
    setTweetsDeduped(deduped.length);
    run.summary.deduped = deduped.length;

    console.log(`[${queryPhrase}] Step 7: Quota selection`);
    run.logs.push("6) Selecting by blue/non-blue quota…");
    const toReply = selectByQuota(deduped);
    run.logs.push(`   ➡️ ${toReply.length} tweets selected for reply`);
    setRepliesSent(toReply.length);
    run.summary.sent = toReply.length;

    console.log(`[${queryPhrase}] Step 8: Sending replies`);
    run.logs.push(`7) Sending ${toReply.length} replies…`);

    const replies: any[] = [];

    for (const tweet of toReply) {
      try {
        console.log(`[${queryPhrase}] Attempting reply for tweet ${tweet.id}`);

        await createReply(tweet, tweet.reply);
        logRepliedTweet(tweet);

        replies.push({
          tweetId: tweet.id,
          reply: tweet.reply,
          author: tweet.author.userName,
          status: "success",
        });

        run.tweets[tweet.id] = {
          reply: tweet.reply,
          author: tweet.author.userName,
          status: "success",
        };

        run.logs.push(`   Replied to ${tweet.id}`);

        // Random spacing between replies (prevents burst behavior)
        await randomDelay(60, 240); // 1–4 minutes

      } catch (err: any) {
        replies.push({
          tweetId: tweet.id,
          reply: tweet.reply,
          author: tweet.author.userName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });

        run.tweets[tweet.id] = {
          reply: tweet.reply,
          author: tweet.author.userName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };

        run.errors.push(
          `   Failed reply to ${tweet.id}: ${err instanceof Error ? err.message : String(err)}`
        );

        console.log(`[${queryPhrase}] Failed reply for tweet ${tweet.id}`, err);
      }
    }

    run.summary.failed = replies.filter((r) => r.status === "failed").length;
    run.replies = replies;

    console.log(`[${queryPhrase}] Step 9: Saving cache`);
    run.logs.push("8) Saving cache…");
    markReplied(toReply);

    console.log(`[${queryPhrase}] Step 10: Logging metrics`);
    logRunMetrics();
    run.logs.push(`Pipeline complete for "${queryPhrase}"\n`);
    console.log(`[${queryPhrase}] Pipeline complete!`);

    return run;

  } catch (err: any) {
    run.errors.push(err instanceof Error ? err.message : String(err));
    console.log(`[${queryPhrase}] Pipeline error:`, err);
    return run;
  }
}