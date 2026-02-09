
import { Tweet } from "./types";
import { TOTAL_REPLIES, BLUE_RATIO } from "./config";

/**
 * Select up to TOTAL_REPLIES tweets, preserving any extra properties (e.g. `reply`).
 */
export function selectByQuota<T extends Tweet>(tweets: T[]): T[] {
  const bluePool    = tweets.filter(t => t.author.isBlueVerified) as T[];
  const nonBluePool = tweets.filter(t => !t.author.isBlueVerified) as T[];

  const sortFn = (a: T, b: T) =>
    b.engagementSum - a.engagementSum || b.engagementRate - a.engagementRate;

  bluePool.sort(sortFn);
  nonBluePool.sort(sortFn);

  const blueQuota    = Math.min(Math.floor(TOTAL_REPLIES * BLUE_RATIO), bluePool.length);
  const nonBlueQuota = TOTAL_REPLIES - blueQuota;

  return [
    ...bluePool.slice(0, blueQuota),
    ...nonBluePool.slice(0, nonBlueQuota),
  ];
}
