
import { Tweet } from "./types";
import {
  loadAuthorTimestamps,
  saveAuthorTimestamps,
  loadRepliedTweetIds,
  saveRepliedTweetIds,
} from "./cache";
import { COOLDOWN_DAYS } from "./config";

const MS_PER_DAY = 1000 * 60 * 60 * 24;


export function filterAlreadyReplied<T extends Tweet>(tweets: T[]): T[] {
  const authorMap = loadAuthorTimestamps();
  const tweetSet  = loadRepliedTweetIds();
  const now       = new Date();

  return tweets.filter(t => {
    if (tweetSet.has(t.id)) return false;
    const last = authorMap.get(t.author.id);
    if (last) {
      const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
      if (daysSince < COOLDOWN_DAYS) return false;
    }
    return true;
  });
}


export function markReplied<T extends Tweet>(tweets: T[]): void {
  const authorMap = loadAuthorTimestamps();
  const tweetSet  = loadRepliedTweetIds();
  const now       = new Date();

  for (const t of tweets) {
    authorMap.set(t.author.id, now);
    tweetSet.add(t.id);
  }

  saveAuthorTimestamps(authorMap);
  saveRepliedTweetIds(tweetSet);
}
