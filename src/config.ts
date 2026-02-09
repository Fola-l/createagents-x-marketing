import * as dotenv from "dotenv";
dotenv.config();

export const API_KEY = process.env.API_KEY!;

export const TWITTER_USERNAME = process.env.TWITTER_USERNAME!; // used by login_v2
export const TWITTER_EMAIL = process.env.TWITTER_EMAIL || "";  // required by login_v2 if you use auth.ts
export const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD!;

export const WEBSHARE_PROXY = process.env.WEBSHARE_PROXY!;

// Stored cookie/session for posting/searching (we read .auth_session first, then fallback to env)
export const AUTH_SESSION = process.env.AUTH_SESSION || "";

// TOTP secret (optional). Only needed if you want to run login via auth.ts non-interactively.
export const TOTP_SECRET = process.env.TOTP_SECRET || "";

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// comma-separated
export const QUERY_PHRASES: string[] = (process.env.QUERY_PHRASES || "")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);

export const QUERY_TYPE = process.env.QUERY_TYPE || "Latest";

export const MAX_FETCH_TWEETS = parseInt(process.env.MAX_FETCH_TWEETS || "100", 10);
export const TOTAL_REPLIES = parseInt(process.env.TOTAL_REPLIES || "20", 10);
export const BLUE_RATIO = parseFloat(process.env.BLUE_RATIO || "0.25");
export const ENGAGEMENT_FLOOR = parseInt(process.env.ENGAGEMENT_FLOOR || "20", 10);

export const REPLY_MODEL = process.env.REPLY_MODEL || "gpt-4-turbo-preview";
export const REPLY_BATCH_SIZE = parseInt(process.env.REPLY_BATCH_SIZE || "10", 10);

export const COOLDOWN_DAYS = parseInt(process.env.COOLDOWN_DAYS || "7", 10);
export const INTERVAL_MINUTES = parseInt(process.env.INTERVAL_MINUTES || "360", 10);

// Persistent disk base (used by cache/logger/metrics)
export const DATA_DIR = process.env.DATA_DIR || "";