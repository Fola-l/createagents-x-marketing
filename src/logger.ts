import * as fs from "fs";
import * as path from "path";
import { TweetWithReply } from "./types";

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "..");
const LOG_DIR = path.join(DATA_DIR, "logs");
const LOG_FILE = path.join(LOG_DIR, "replied_tweets.jsonl");

export function logRepliedTweet(tweet: TweetWithReply): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const entry = {
    tweetId: tweet.id,
    authorId: tweet.author.id,
    authorUser: tweet.author.userName,
    text: tweet.text,
    reply: tweet.reply,
    repliedAt: new Date().toISOString(),
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", {
    encoding: "utf-8",
  });
}