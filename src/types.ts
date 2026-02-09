
export interface Author {
  id: string;
  userName: string;   
  isBlueVerified: boolean;
  verifiedType: string;
  // …you can add more fields if you need them later
}

export interface API_Tweet {
  id: string;
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  author: Author;
}

export interface SearchResponse {
  tweets: API_Tweet[];
  has_next_page: boolean;
  next_cursor: string;
}

export interface Tweet extends API_Tweet {
  engagementSum: number;
  engagementRate: number;
}
export interface TweetWithReply extends Tweet {
  reply: string;
}