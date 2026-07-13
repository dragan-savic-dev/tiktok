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
  share_url?: string;
  /** Titolo del video (spesso vuoto: molti TikTok non lo impostano). */
  title?: string;
  /** Didascalia/descrizione del video. */
  video_description?: string;
  /** Data di pubblicazione in secondi Unix. */
  create_time?: number;
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
  /** Statistiche per singolo video, ordinate come le ritorna TikTok (dalla più recente). */
  videos: VideoStats[];
  /** Totale "salvati" via scraping delle pagine pubbliche; null se non disponibile. */
  saved: number | null;
  fetchedAt: number;
}

/** Fotografia delle statistiche in un istante, salvata nello store storico. */
export interface HistorySnapshot {
  /** Epoch ms del momento in cui è stata registrata. */
  t: number;
  followers: number;
  following: number;
  /** Mi piace totali del profilo (user.likes_count). */
  likes: number;
  views: number;
  comments: number;
  shares: number;
  saved: number | null;
  /** Numero di video pubblici conteggiati. */
  videos: number;
}

/** Un punto giornaliero: l'ultimo valore noto di quel giorno. */
export interface DailyPoint extends HistorySnapshot {
  /** Giorno in formato YYYY-MM-DD (fuso orario del server). */
  day: string;
}

/** Variazione di una metrica su una finestra; null se lo storico non basta. */
export interface HistoryDelta {
  today: number | null;
  week: number | null;
}

export interface HistoryResponse {
  daily: DailyPoint[];
  deltas: {
    followers: HistoryDelta;
    views: HistoryDelta;
    likes: HistoryDelta;
  };
  /** Epoch ms dello snapshot più vecchio disponibile (null se store vuoto). */
  firstAt: number | null;
  /** Numero totale di snapshot memorizzati per l'utente. */
  count: number;
}
