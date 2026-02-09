import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "..");
const LOG_DIR = path.join(DATA_DIR, "logs");
const METRICS_FILE = path.join(LOG_DIR, "run_metrics.jsonl");

let authCalls = 0;
let fetchCalls = 0;
let replyCalls = 0;
let repliesSent = 0;

// New counters:
let tweetsFetched = 0;
let tweetsAfterFloor = 0;
let tweetsWithReplies = 0;
let tweetsDeduped = 0;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function resetMetrics(): void {
  authCalls = 0;
  fetchCalls = 0;
  replyCalls = 0;
  repliesSent = 0;
  tweetsFetched = 0;
  tweetsAfterFloor = 0;
  tweetsWithReplies = 0;
  tweetsDeduped = 0;
}

export function incrementAuthCalls(): void {
  authCalls++;
}

export function incrementFetchCalls(): void {
  fetchCalls++;
}

export function incrementReplyCalls(): void {
  replyCalls++;
}

export function setRepliesSent(count: number): void {
  repliesSent = count;
}

// New setters:
export function setTweetsFetched(count: number): void {
  tweetsFetched = count;
}

export function setTweetsAfterFloor(count: number): void {
  tweetsAfterFloor = count;
}

export function setTweetsWithReplies(count: number): void {
  tweetsWithReplies = count;
}

export function setTweetsDeduped(count: number): void {
  tweetsDeduped = count;
}

export function logRunMetrics(): void {
  ensureLogDir();
  const entry = {
    runAt: new Date().toISOString(),
    authCalls,
    fetchCalls,
    tweetsFetched,
    tweetsAfterFloor,
    tweetsWithReplies,
    tweetsDeduped,
    replyCalls,
    repliesSent,
  };
  fs.appendFileSync(METRICS_FILE, JSON.stringify(entry) + "\n", "utf-8");
}