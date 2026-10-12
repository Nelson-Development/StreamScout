import { Injectable, signal } from '@angular/core';

export interface WatchlistItem {
  id?: string;
  user_id: string;
  movie_id: number;
  title: string;
  poster_path: string;
  media_type: 'movie' | 'tv';
}

export interface LibrarySnapshot {
  v: 1;
  region: string;
  services: number[];
  watchlist: WatchlistItem[];
}

const STORAGE_KEY = 'ss:v1';
const LEGACY_REGION_KEY = 'streamfinder_region';

/** Stable id so call sites that used to pass a user id keep working. */
export const LOCAL_USER_ID = 'local';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  /**
   * Always set. The app has no accounts; this exists so components can keep
   * the same "current user id" checks they already had.
   */
  readonly currentUser = signal<{ id: string }>({ id: LOCAL_USER_ID });

  private loaded = false;
  private memory: LibrarySnapshot = { v: 1, region: 'ZA', services: [], watchlist: [] };

  getRegion(): string {
    return this.read().region;
  }

  setRegion(code: string): void {
    const state = this.read();
    state.region = code || 'ZA';
    this.write(state);
  }

  async getUserServices(_userId: string): Promise<number[]> {
    return this.read().services;
  }

  async setUserServices(_userId: string, providerIds: number[]): Promise<void> {
    const state = this.read();
    state.services = [...providerIds];
    this.write(state);
  }

  async getWatchlist(_userId: string): Promise<WatchlistItem[]> {
    return this.read().watchlist;
  }

  /** Insert once per media type + TMDB id. A second add of the same title is a no-op. */
  async addToWatchlist(item: WatchlistItem): Promise<void> {
    const state = this.read();
    const exists = state.watchlist.some(
      (row) => row.movie_id === item.movie_id && row.media_type === item.media_type,
    );
    if (exists) return;
    state.watchlist.unshift({
      ...item,
      user_id: LOCAL_USER_ID,
      id: item.id ?? newId(),
    });
    this.write(state);
  }

  async removeFromWatchlist(
    _userId: string,
    movieId: number,
    mediaType?: 'movie' | 'tv',
  ): Promise<void> {
    const state = this.read();
    state.watchlist = state.watchlist.filter((row) => {
      if (row.movie_id !== movieId) return true;
      if (mediaType && row.media_type !== mediaType) return true;
      return false;
    });
    this.write(state);
  }

  exportJson(): string {
    return JSON.stringify(this.read(), null, 2);
  }

  importJson(raw: string): LibrarySnapshot {
    const snapshot = parseSnapshot(JSON.parse(raw));
    this.write(snapshot);
    return this.read();
  }

  shareToken(): string {
    return encodeShare(this.read());
  }

  /**
   * Apply `#s=<token>` from the current URL, then remove it.
   * Returns true only when the token was valid and replaced local state.
   */
  consumeShareFromLocation(): boolean {
    const hash = window.location.hash;
    if (!hash.startsWith('#s=')) return false;
    let applied = false;
    try {
      const token = decodeURIComponent(hash.slice(3));
      this.write(decodeShare(token));
      applied = true;
    } catch {
      applied = false;
    }
    const next = window.location.pathname + window.location.search;
    history.replaceState(null, '', next);
    return applied;
  }

  private read(): LibrarySnapshot {
    this.ensureLoaded();
    return cloneSnapshot(this.memory);
  }

  private write(state: LibrarySnapshot): void {
    this.loaded = true;
    this.memory = cloneSnapshot(parseSnapshot(state));
    this.persist();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    const stored = this.tryRead();
    if (stored) {
      this.memory = stored;
      return;
    }
    let region = 'ZA';
    try {
      region = localStorage.getItem(LEGACY_REGION_KEY) || 'ZA';
    } catch {
      region = 'ZA';
    }
    this.memory = { v: 1, region, services: [], watchlist: [] };
    this.persist();
  }

  private tryRead(): LibrarySnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return parseSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
    } catch {
      // Storage can throw in private mode. The in-memory copy still works this session.
    }
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneSnapshot(state: LibrarySnapshot): LibrarySnapshot {
  return {
    v: 1,
    region: state.region,
    services: [...state.services],
    watchlist: state.watchlist.map((item) => ({ ...item })),
  };
}

export function parseSnapshot(value: unknown): LibrarySnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid library file');
  }
  const record = value as Record<string, unknown>;
  const region = typeof record['region'] === 'string' && record['region'] ? record['region'] : 'ZA';
  const services = Array.isArray(record['services'])
    ? record['services'].filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
    : [];

  const watchlist: WatchlistItem[] = [];
  if (Array.isArray(record['watchlist'])) {
    for (const item of record['watchlist']) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const movieId = row['movie_id'];
      const mediaType = row['media_type'];
      const title = row['title'];
      if (typeof movieId !== 'number' || !Number.isFinite(movieId)) continue;
      if (mediaType !== 'movie' && mediaType !== 'tv') continue;
      if (typeof title !== 'string') continue;
      const poster = row['poster_path'];
      const id = row['id'];
      watchlist.push({
        id: typeof id === 'string' ? id : undefined,
        user_id: LOCAL_USER_ID,
        movie_id: movieId,
        title,
        poster_path: typeof poster === 'string' ? poster : '',
        media_type: mediaType,
      });
    }
  }

  const seen = new Set<string>();
  const unique = watchlist.filter((item) => {
    const key = `${item.media_type}:${item.movie_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { v: 1, region, services, watchlist: unique };
}

function encodeShare(state: LibrarySnapshot): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeShare(token: string): LibrarySnapshot {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return parseSnapshot(JSON.parse(new TextDecoder().decode(bytes)));
}
