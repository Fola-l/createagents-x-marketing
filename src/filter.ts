
import { Tweet } from "./types";
import { ENGAGEMENT_FLOOR } from "./config";

export function filterByFloor(
  tweets: Tweet[],
  floor = ENGAGEMENT_FLOOR
): Tweet[] {
  return tweets.filter(t => t.engagementSum >= floor);
}
