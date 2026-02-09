import OpenAI from "openai";
import { Tweet, TweetWithReply } from "./types";
import {
  OPENAI_API_KEY,
  ENGAGEMENT_FLOOR,
  REPLY_MODEL,
  REPLY_BATCH_SIZE,
} from "./config";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Filters tweets for genuine interest and generates human-like replies for CreateAgents/DeployAgents.
 * - Keeps existing batching + JSON parsing behavior
 * - Avoids links unless the tweet explicitly asks for a tool/link/demo
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
You’re the support account for CreateAgents (DeployAgents) — a platform to create and deploy AI chat agents connected to messaging channels like WhatsApp and Telegram.

Your mission:
- From the list of tweets below, select ONLY those showing a real (explicit or implicit) need for:
  • chat agents / AI assistants, or
  • automating conversations (support, sales, ops), or
  • WhatsApp/Telegram automation, lead qualification, answering FAQs, handling inbound messages, follow-ups, etc.

Implicit cues include:
- “I wish there was a bot/agent that…”
- “Support is overwhelming / too many DMs”
- “Need automation for WhatsApp/Telegram”
- “How do people handle customer replies at scale?”
- “Looking for an AI assistant to respond…”

Do NOT select tweets that are:
- generic AI hype/news
- memes/jokes with no actual need
- purely discussing stock/crypto/celebs
- unrelated to messaging, support, sales, operations, or automation

Reply rules (must follow):
- Mirror the tweet’s tone and be conversational (human, not salesy).
- Keep replies <= 240 characters.
- Ask a short question when it feels natural (to continue the convo).
- Do NOT include a link by default.
  Only include the landing page link if (and only if) the tweet explicitly asks for a link/tool/demo/recommendation/resource.
  Landing page: https://deployagents.lovable.app/
- Avoid buzzwords like “revolutionary”, “game-changing”, “disrupt”.
- Do not use hashtags.
- Use at most 1 emoji, and only if the tweet already uses emojis or the vibe is casual.

Now, given these tweets about "${queryPhrase}" (each >= ${ENGAGEMENT_FLOOR} engagements):
1) Select the tweets that match the “real need” criteria above.
2) For each selected tweet, craft a reply following the reply rules.
3) If a tweet is relevant but unclear, ask ONE clarifying question in the reply.

Output format (IMPORTANT):
Respond with exactly the raw JSON object (no markdown fences, no extra text):
{
  "<tweetId>": { "reply": "<your crafted reply>" },
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
      console.error("Failed to parse AI JSON:", raw);
      continue;
    }

    for (const t of batch) {
      const entry = parsed[t.id];
      if (entry?.reply) {
        results.push({ ...t, reply: entry.reply });
      }
    }
  }

  return results;
}