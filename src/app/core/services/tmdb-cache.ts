const PREFIX = 'ss:cache:';

interface CacheEntry<T> {
  exp: number;
  data: T;
}

/** How long a successful TMDB response stays fresh in localStorage. */
export const TMDB_TTL = {
  genres: 7 * 24 * 60 * 60 * 1000,
  providerList: 24 * 60 * 60 * 1000,
  titleProviders: 24 * 60 * 60 * 1000,
  browse: 6 * 60 * 60 * 1000,
  search: 60 * 60 * 1000,
} as const;

export function tmdbCacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.exp !== 'number' || Date.now() > entry.exp) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function tmdbCacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { exp: Date.now() + ttlMs, data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Private mode or quota. The request still succeeds; the next visit refetches.
  }
}
