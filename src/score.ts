
import { API_Tweet, Tweet } from "./types";

export function annotateEngagement(tweets: API_Tweet[]): Tweet[] {
  return tweets.map(t => {
    const engagementSum = t.likeCount + t.retweetCount + t.replyCount + t.quoteCount;
    const engagementRate = engagementSum / (t.viewCount + 1);
    return { ...t, engagementSum, engagementRate };
  });
}
