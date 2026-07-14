export interface TikTokUser {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name?: string;
  username?: string;
  is_verified?: boolean;
  /** Bio del profilo (vuota se non impostata). */
  bio_description?: string;
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
  /** URL della copertina (CDN TikTok, a scadenza). */
  cover_image_url?: string;
  /** Durata del video in secondi. */
  duration?: number;
  /** Altezza del video in pixel (per il ratio originale della copertina). */
  height?: number;
  /** Larghezza del video in pixel. */
  width?: number;
  /** URL embed ufficiale tiktok.com per il player incorporato. */
  embed_link?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  /**
   * "Salvati" del video, via scraping della pagina pubblica (non esposto
   * dalla Display API). null/assente se non disponibile.
   */
  saved_count?: number | null;
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

/** Un punto della serie storica: l'ultimo valore noto del bucket. */
export interface DailyPoint extends HistorySnapshot {
  /**
   * Bucket in formato YYYY-MM-DD (granularità giornaliera) oppure
   * "YYYY-MM-DD HH" (granularità oraria), nel fuso orario del server.
   */
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
    comments: HistoryDelta;
    shares: HistoryDelta;
    saved: HistoryDelta;
  };
  /** Epoch ms dello snapshot più vecchio disponibile (null se store vuoto). */
  firstAt: number | null;
  /** Numero totale di snapshot memorizzati per l'utente. */
  count: number;
}
