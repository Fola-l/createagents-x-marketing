import { Tweet } from "./types";
import { ENGAGEMENT_FLOOR } from "./config";

/**
 * Keep tweets above engagement threshold and that are reply-able.
 */
export function filterByFloor(tweets: Tweet[], floor = ENGAGEMENT_FLOOR): Tweet[] {
  return tweets.filter((t: any) => {
    if (t.engagementSum < floor) return false;

    // Skip tweets where replies are restricted
    if (t.isLimitedReply === true) return false;

    return true;
  });
}
