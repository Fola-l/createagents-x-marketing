import { API_KEY, WEBSHARE_PROXY } from "./config";
import { loadAuthSession } from "./session";
import { incrementReplyCalls } from "./metrics";

type CreateTweetV2Response =
  | { status: "success"; tweet_id: string; msg?: string; code?: number }
  | { status: "error"; message?: string; msg?: string; code?: number }
  | any;

export async function createReply(
  tweet: { id: string },
  replyText: string
): Promise<void> {
  const login_cookies = loadAuthSession();

  if (!login_cookies) {
    throw new Error("No login cookie found in .auth_session.");
  }
  if (!WEBSHARE_PROXY) {
    throw new Error("Missing WEBSHARE_PROXY in env.");
  }

  incrementReplyCalls();

  const res = await fetch("https://api.twitterapi.io/twitter/create_tweet_v2", {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login_cookies,
      tweet_text: replyText,
      proxy: WEBSHARE_PROXY,
      reply_to_tweet_id: tweet.id,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as CreateTweetV2Response;

  // twitterapi.io may return HTTP 200 even on failures, so rely on JSON `status`.
  if (json?.status !== "success") {
    const msg = json?.message || json?.msg || res.statusText || "Unknown error";
    const code = json?.code ? ` (code ${json.code})` : "";
    throw new Error(`Reply failed: ${msg}${code}`);
  }

  // success
  if (!json.tweet_id) {
    // rare edge case: success but missing tweet_id
    throw new Error("Reply returned success but missing tweet_id.");
  }
}
