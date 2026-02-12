// src/filterAndReply.ts

import OpenAI from "openai";
import { Tweet, TweetWithReply } from "./types";
import {
  OPENAI_API_KEY,
  ENGAGEMENT_FLOOR,
  REPLY_MODEL,
  REPLY_BATCH_SIZE,
} from "./config";
import { scoreReply } from "./replyScoring";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const LANDING_PAGE = "https://createagents.online/";

// If score < threshold, reply is skipped (not posted)
const MIN_REPLY_SCORE = 2;

/**
 * Selects tweets showing real pain/need (operator + builder) and generates
 * human replies that signal credibility (not sales).
 *
 * - Keeps batching + JSON parsing behavior
 * - Avoids links unless tweet explicitly asks for a tool/link/demo/resource
 * - Adds a reply scoring gate (credibility vs fluff)
 */
export async function filterAndReply(
  tweets: Tweet[],
  queryPhrase: string
): Promise<TweetWithReply[]> {
  // Split into batches of size REPLY_BATCH_SIZE
  const batches: Tweet[][] = [];
  for (let i = 0; i < tweets.length; i += REPLY_BATCH_SIZE) {
    batches.push(tweets.slice(i, i + REPLY_BATCH_SIZE));
  }

  const results: TweetWithReply[] = [];

  for (const batch of batches) {
    const items = batch
      .map(
        (t) => `ID: ${t.id}
Engagements: ${t.engagementSum}
Text: "${t.text.replace(/"/g, '\\"')}"`
      )
      .join("\n\n");

    const prompt = `
You are a member of the CreateAgents founding team — builders of a platform for deploying production AI agents connected to messaging channels like WhatsApp and Telegram. You know this space deeply and engage authentically on X/Twitter.

Your goal: find real pain, add genuine value — build credibility as serious infrastructure, not spam a product.

BRAND VOICE:
- Founder-to-founder, direct, knowledgeable
- "We've solved this" energy, not "buy our product" energy
- Technical enough to earn builder respect
- Plain enough to land with operators drowning in tickets
- Never hype, never salesy, never buzzwords

SELECT tweets that show genuine pain, curiosity, or frustration around:

PRIMARY TARGETS (operator/founder pain):
  • Inbound message volume overwhelming teams (WhatsApp, Telegram, DMs)
  • Lead qualification, FAQ handling, repetitive ops conversations
  • "How does X handle support at scale?" type questions
  • Wanting a bot/agent that responds automatically to messages
  • Support costs, hiring for support, scaling ops conversations

SECONDARY TARGETS (builder/infra pain):
  • Deploying or running AI agents in production
  • Managing agent infrastructure — hosting, uptime, state, memory
  • Webhook management, bot reliability, keeping agents running
  • Agent memory / context persistence across conversations
  • "Is there a better way to..." questions about agent deployment

IMPLICIT PAIN SIGNALS — include these:
  - "I wish there was a bot that..."
  - "Our support/DMs are overwhelming"
  - "Tired of maintaining this Telegram bot"
  - "How do you handle customer replies at scale?"
  - "AI agent keeps breaking / going down"
  - "Need something to handle inbound leads automatically"
  - "We can't keep up with WhatsApp messages"

DO NOT SELECT:
  - Generic AI hype or news with no personal pain signal
  - Memes, jokes, or purely theoretical AI takes
  - Crypto/stock/celeb content with tangential AI mentions
  - Competitor marketing posts
  - Posts where someone already has a solution they're happy with

REPLY RULES:
1. Match tone — casual if they're casual, technical if they're technical
2. For OPERATOR tweets: validate the pain first, hint at scale. No product pitch.
3. For BUILDER tweets: engage peer-to-peer. Share a real insight or ask about their stack.
4. Ask ONE genuine question when it naturally moves the conversation forward
5. Replies ≤ 240 characters
6. NO link by default. Only include ${LANDING_PAGE} if they explicitly ask for a tool, demo, link, or resource recommendation
7. NO hashtags
8. At most 1 emoji — only if they used one or the vibe is clearly casual
9. NO buzzwords: "revolutionary", "game-changing", "disrupt", "next-gen"
10. Never open with "We" or a product name — lead with insight or a question

Now process the following tweets about "${queryPhrase}" (each with >= ${ENGAGEMENT_FLOOR} engagements):

1) Select only tweets matching the criteria above
2) For each selected tweet, write a reply following all reply rules
3) If a tweet is relevant but the need is unclear, ask ONE clarifying question

Output format — raw JSON only, no markdown fences:
{
  "<tweetId>": { "reply": "<crafted reply>" },
  ...
}

TWEETS:
${items}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: REPLY_MODEL,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    let raw = completion.choices[0]?.message?.content || "{}";
    raw = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");

    let parsed: Record<string, { reply: string }> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error(
        `[${queryPhrase}] Failed to parse AI JSON. Raw:\n${raw}\n---`
      );
      continue;
    }

    for (const t of batch) {
      const entry = parsed[t.id];
      if (!entry?.reply) continue;

      const reply = entry.reply.trim().slice(0, 240);
      const score = scoreReply(reply);

      if (score >= MIN_REPLY_SCORE) {
        results.push({ ...t, reply });
      } else {
        console.log(
          `[${queryPhrase}] Skipped low-score reply (score=${score}) for tweet ${t.id}: ${reply}`
        );
      }
    }
  }

  return results;
}
