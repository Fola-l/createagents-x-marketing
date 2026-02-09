import {
  API_KEY,
  TWITTER_USERNAME,
  TWITTER_EMAIL,
  TWITTER_PASSWORD,
  WEBSHARE_PROXY,
  TOTP_SECRET,
} from "./config";
import { saveAuthSession } from "./session";
import { incrementAuthCalls } from "./metrics";

interface LoginV2Response {
  login_cookie?: string;
  status?: string;
  msg?: string;
}

export async function authenticateV2(): Promise<string> {
  if (!TWITTER_USERNAME || !TWITTER_PASSWORD || !WEBSHARE_PROXY) {
    throw new Error("Missing TWITTER_USERNAME / TWITTER_PASSWORD / WEBSHARE_PROXY in env.");
  }
  if (!TWITTER_EMAIL) {
    throw new Error("Missing TWITTER_EMAIL in env (required by user_login_v2).");
  }

  console.log("🔐 Logging in via user_login_v2…");
  incrementAuthCalls();

  const res = await fetch("https://api.twitterapi.io/twitter/user_login_v2", {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_name: TWITTER_USERNAME,
      email: TWITTER_EMAIL,
      password: TWITTER_PASSWORD,
      proxy: WEBSHARE_PROXY,
      // Optional (only include if you have it)
      ...(TOTP_SECRET ? { totp_secret: TOTP_SECRET } : {}),
    }),
  });

  const json = (await res.json()) as LoginV2Response;

  if (!res.ok || json.status !== "success" || !json.login_cookie) {
    throw new Error(`Login failed (${res.status}): ${json.msg || "unknown error"}`);
  }

  console.log("✅ Login successful. Saving login_cookie to .auth_session");
  saveAuthSession(json.login_cookie);
  return json.login_cookie;
}

// run directly: ts-node src/auth.ts
if (require.main === module) {
  authenticateV2()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}