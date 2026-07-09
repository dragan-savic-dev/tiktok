export interface TikTokUser {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name?: string;
  username?: string;
  is_verified?: boolean;
  profile_deep_link?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface VideoStats {
  id: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export interface VideoTotals {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videosCounted: number;
}

export interface StatsResponse {
  user: TikTokUser;
  totals: VideoTotals;
  fetchedAt: number;
}
