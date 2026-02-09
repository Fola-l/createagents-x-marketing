import { API_KEY, AUTH_SESSION, WEBSHARE_PROXY } from "./config";
import { loadAuthSession } from "./session";
import { incrementReplyCalls } from "./metrics";

type CreateTweetV2Response = {
  tweet_id?: string;
  status?: string;
  msg?: string;
};

export async function createReply(
  tweet: { id: string },
  replyText: string
): Promise<void> {
  const login_cookies = loadAuthSession() || AUTH_SESSION;

  if (!login_cookies) {
    throw new Error("No login cookie found. Put login_cookie into .auth_session or AUTH_SESSION env.");
  }
  if (!WEBSHARE_PROXY) {
    throw new Error("WEBSHARE_PROXY is required for create_tweet_v2.");
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

  if (!res.ok || json.status !== "success" || !json.tweet_id) {
    throw new Error(`Reply failed (${res.status}): ${json.msg || res.statusText}`);
  }
}