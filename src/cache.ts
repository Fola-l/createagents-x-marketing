import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "..");
const CACHE_DIR = path.join(DATA_DIR, "cache");

const AUTHOR_CACHE_FILE = path.join(CACHE_DIR, "replied_authors.json");
const TWEET_CACHE_FILE = path.join(CACHE_DIR, "replied_tweets.json");

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function loadAuthorTimestamps(): Map<string, Date> {
  ensureDir();
  if (!fs.existsSync(AUTHOR_CACHE_FILE)) return new Map();
  const raw = fs.readFileSync(AUTHOR_CACHE_FILE, "utf-8");
  const obj: Record<string, string> = JSON.parse(raw);
  const map = new Map<string, Date>();
  for (const [id, ts] of Object.entries(obj)) {
    map.set(id, new Date(ts));
  }
  return map;
}

export function saveAuthorTimestamps(map: Map<string, Date>): void {
  ensureDir();
  const obj: Record<string, string> = {};
  for (const [id, date] of map.entries()) {
    obj[id] = date.toISOString();
  }
  fs.writeFileSync(AUTHOR_CACHE_FILE, JSON.stringify(obj), "utf-8");
}

export function loadRepliedTweetIds(): Set<string> {
  ensureDir();
  if (!fs.existsSync(TWEET_CACHE_FILE)) return new Set();
  const raw = fs.readFileSync(TWEET_CACHE_FILE, "utf-8");
  const arr: string[] = JSON.parse(raw);
  return new Set(arr);
}

export function saveRepliedTweetIds(set: Set<string>): void {
  ensureDir();
  fs.writeFileSync(TWEET_CACHE_FILE, JSON.stringify(Array.from(set)), "utf-8");
}