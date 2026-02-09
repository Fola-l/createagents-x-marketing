

import { SearchResponse, API_Tweet } from "./types";
import { API_KEY } from "./config";
import { incrementFetchCalls } from "./metrics";

/**
 * Fetch up to `maxTweets` matching tweets, excluding replies & retweets at the query level.
 *
 * @param query      The base search phrase (e.g. your product name).
 * @param queryType  The search type ("Latest" or "Top").
 * @param maxTweets  The maximum number of tweets to retrieve.
 */
export async function fetchTweets(
  query: string,
  queryType: string,
  maxTweets: number
): Promise<API_Tweet[]> {
  const operators = "-filter:replies -filter:retweets";
  const fullQuery = `${query} ${operators}`.trim();

  let all: API_Tweet[] = [];
  let cursor = "";

  while (all.length < maxTweets) {
    incrementFetchCalls();

    const url = new URL(
      "https://api.twitterapi.io/twitter/tweet/advanced_search"
    );
    url.searchParams.set("query", fullQuery);
    url.searchParams.set("queryType", queryType);
    url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-API-Key": API_KEY },
    });
    if (!res.ok) {
      throw new Error(`Search failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as SearchResponse;
    all.push(...json.tweets);

    if (!json.has_next_page) break;
    cursor = json.next_cursor;
  }

  // Return exactly up to maxTweets
  return all.slice(0, maxTweets);
}
