import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, switchMap, catchError, tap, mergeMap, timeout, toArray } from 'rxjs/operators';
import { LibraryService } from '@core/services/library.service';
import { TMDB_TTL, tmdbCacheGet, tmdbCacheSet } from '@core/services/tmdb-cache';

export const SUPPORTED_REGIONS = [
  { code: 'ZA', name: 'South Africa' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
] as const;

export interface Genre {
  id: number;
  name: string;
}
import { environment } from '@environments/environment';

export interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv' | 'person';
  poster_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  popularity?: number;
  providers?: number[]; // TMDB provider IDs available in ZA
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface SearchResult extends TmdbResult {
  displayTitle: string;
  displayDate: string;
  availableOn: WatchProvider[];
  isMatch: boolean; // true if any provider in user's subscriptions
}

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private library = inject(LibraryService);
  private baseUrl = environment.tmdb.baseUrl;

  region = signal<string>(this.library.getRegion());

  setRegion(code: string): void {
    this.region.set(code);
    this.library.setRegion(code);
  }

  getProvidersForRegion(regionCode: string): Observable<WatchProvider[]> {
    return this.cached(
      `providers:${regionCode}`,
      TMDB_TTL.providerList,
      this.fetchProviders(regionCode),
    ).pipe(catchError(() => of([])));
  }

  private fetchProviders(regionCode: string): Observable<WatchProvider[]> {
    const load = (kind: 'movie' | 'tv') =>
      this.http
        .get<{ results: WatchProvider[] }>(`${this.baseUrl}/watch/providers/${kind}`, {
          headers: this.headers,
          params: { watch_region: regionCode },
        })
        .pipe(
          timeout(5000),
          map((res) => ({ ok: true as const, results: res.results ?? [] })),
          catchError(() => of({ ok: false as const, results: [] as WatchProvider[] })),
        );

    return forkJoin([load('movie'), load('tv')]).pipe(
      map(([movies, tv]) => {
        if (!movies.ok && !tv.ok) {
          throw new Error('provider list unavailable');
        }
        const providers = [...movies.results];
        const seenIds = new Set(providers.map((p) => p.provider_id));
        for (const provider of tv.results) {
          if (!seenIds.has(provider.provider_id)) {
            providers.push(provider);
            seenIds.add(provider.provider_id);
          }
        }
        if (regionCode === 'ZA') {
          for (const entry of this.FALLBACK_PROVIDER_ENTRIES) {
            if (!seenIds.has(entry.provider_id)) providers.push(entry);
          }
        }
        return providers;
      }),
    );
  }

  getGenres(type: 'movie' | 'tv'): Observable<Genre[]> {
    return this.cached(
      `genres:${type}`,
      TMDB_TTL.genres,
      this.http
        .get<{ genres: Genre[] }>(`${this.baseUrl}/genre/${type}/list`, { headers: this.headers })
        .pipe(
          timeout(5000),
          map((res) => res.genres),
        ),
    ).pipe(catchError(() => of([])));
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${environment.tmdb.readAccessToken}`,
      accept: 'application/json',
    });
  }

  searchMulti(query: string): Observable<TmdbResult[]> {
    const key = `search:${query.trim().toLowerCase()}`;
    return this.cached(
      key,
      TMDB_TTL.search,
      this.http
        .get<{ results: TmdbResult[] }>(`${this.baseUrl}/search/multi`, {
          headers: this.headers,
          params: { query, language: 'en-US', page: '1' },
        })
        .pipe(
          timeout(5000),
          map((res) =>
            res.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv'),
          ),
        ),
    );
  }

  // Provider IDs not tracked by TMDB for ZA — fall back to global presence
  private readonly GLOBAL_FALLBACK_IDS = [337]; // Disney+ (Showmax has no TMDB entry)

  // Full provider entries for GLOBAL_FALLBACK_IDS — used when TMDB omits them from a region's list
  private readonly FALLBACK_PROVIDER_ENTRIES: WatchProvider[] = [
    {
      provider_id: 337,
      provider_name: 'Disney Plus',
      logo_path: '/97yvRBw1GzX7fXprcF80er19ot.jpg',
    },
  ];

  getWatchProviders(id: number, mediaType: 'movie' | 'tv'): Observable<WatchProvider[]> {
    const region = this.region();
    const key = `title-providers:${mediaType}-${id}-${region}`;

    return this.cached(
      key,
      TMDB_TTL.titleProviders,
      this.http
        .get<{
          results: Record<string, { flatrate?: WatchProvider[] }>;
        }>(`${this.baseUrl}/${mediaType}/${id}/watch/providers`, { headers: this.headers })
        .pipe(
          timeout(5000),
          map((res) => {
            const regionProviders: WatchProvider[] = res.results?.[region]?.flatrate ?? [];
            // ZA-specific: Showmax has no TMDB entry so Disney+ falls back to global presence
            if (region === 'ZA') {
              const seenIds = new Set(regionProviders.map((p) => p.provider_id));
              for (const r of Object.values(res.results ?? {})) {
                for (const provider of r.flatrate ?? []) {
                  if (
                    this.GLOBAL_FALLBACK_IDS.includes(provider.provider_id) &&
                    !seenIds.has(provider.provider_id)
                  ) {
                    regionProviders.push(provider);
                    seenIds.add(provider.provider_id);
                  }
                }
              }
            }
            return regionProviders;
          }),
        ),
    ).pipe(catchError(() => of([])));
  }

  searchWithProviders(query: string, userProviderIds: number[]): Observable<SearchResult[]> {
    return this.searchMulti(query).pipe(
      switchMap((results) => {
        if (results.length === 0) return of([]);
        // Max 5 concurrent provider lookups to stay inside TMDB rate limits
        return from(results).pipe(
          mergeMap(
            (r) =>
              this.getWatchProviders(r.id, r.media_type as 'movie' | 'tv').pipe(
                map(
                  (providers): SearchResult => ({
                    ...r,
                    displayTitle: r.title ?? r.name ?? 'Unknown',
                    displayDate: r.release_date ?? r.first_air_date ?? '',
                    availableOn: providers,
                    isMatch: providers.some((p) => userProviderIds.includes(p.provider_id)),
                  }),
                ),
              ),
            5,
          ),
          toArray(),
        );
      }),
    );
  }

  getTrending(type: 'movie' | 'tv'): Observable<TmdbResult[]> {
    return this.cached(
      `trending:${type}`,
      TMDB_TTL.browse,
      this.http
        .get<{ results: TmdbResult[] }>(`${this.baseUrl}/trending/${type}/week`, {
          headers: this.headers,
        })
        .pipe(
          timeout(5000),
          map((res) => res.results.map((r) => ({ ...r, media_type: type }))),
        ),
    ).pipe(catchError(() => of([])));
  }

  getList(
    type: 'movie' | 'tv',
    list: 'popular' | 'top_rated' | 'now_playing' | 'on_the_air' | 'airing_today',
  ): Observable<TmdbResult[]> {
    return this.cached(
      `list:${type}:${list}`,
      TMDB_TTL.browse,
      this.http
        .get<{ results: TmdbResult[] }>(`${this.baseUrl}/${type}/${list}`, {
          headers: this.headers,
          params: { language: 'en-US', page: '1' },
        })
        .pipe(
          timeout(5000),
          map((res) => res.results.map((r) => ({ ...r, media_type: type }))),
        ),
    ).pipe(catchError(() => of([])));
  }

  getOnServices(
    type: 'movie' | 'tv',
    providerIds: number[],
    genreIds: number[] = [],
  ): Observable<TmdbResult[]> {
    return this.discover(type, providerIds, 'popularity.desc', {}, genreIds);
  }

  // Discover without provider filter — used when genres are selected but myServicesOnly is off
  discoverByGenre(
    type: 'movie' | 'tv',
    genreIds: number[],
    sortBy = 'popularity.desc',
  ): Observable<TmdbResult[]> {
    if (genreIds.length === 0) return of([]);
    const key = `genre:${type}:${[...genreIds].sort((a, b) => a - b).join(',')}:${sortBy}`;
    return this.cached(
      key,
      TMDB_TTL.browse,
      this.http
        .get<{ results: TmdbResult[] }>(`${this.baseUrl}/discover/${type}`, {
          headers: this.headers,
          params: { with_genres: genreIds.join('|'), sort_by: sortBy, page: '1' },
        })
        .pipe(
          timeout(5000),
          map((res) => res.results.map((r) => ({ ...r, media_type: type }))),
        ),
    ).pipe(catchError(() => of([])));
  }

  discover(
    type: 'movie' | 'tv',
    providerIds: number[],
    sortBy: string,
    extra: Record<string, string> = {},
    genreIds: number[] = [],
  ): Observable<TmdbResult[]> {
    if (providerIds.length === 0) return of([]);

    const region = this.region();

    // Non-ZA regions: discover directly with the selected region
    if (region !== 'ZA') {
      return this.discoverRaw(type, providerIds, region, sortBy, extra, genreIds);
    }

    // ZA-specific: split out global-fallback providers (e.g. Disney+) and query US for those
    const localIds = providerIds.filter((id) => !this.GLOBAL_FALLBACK_IDS.includes(id));
    const globalIds = providerIds.filter((id) => this.GLOBAL_FALLBACK_IDS.includes(id));

    const calls: Observable<TmdbResult[]>[] = [];
    if (localIds.length > 0)
      calls.push(this.discoverRaw(type, localIds, 'ZA', sortBy, extra, genreIds));
    if (globalIds.length > 0)
      calls.push(this.discoverRaw(type, globalIds, 'US', sortBy, extra, genreIds));

    if (calls.length === 0) return of([]);
    if (calls.length === 1) return calls[0];

    return forkJoin(calls).pipe(
      map(([localResults, globalResults]) => {
        const seen = new Set(localResults.map((r) => r.id));
        const merged = [...localResults];
        for (const item of globalResults) {
          if (!seen.has(item.id)) {
            merged.push(item);
            seen.add(item.id);
          }
        }
        return merged.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
      }),
    );
  }

  private discoverRaw(
    type: 'movie' | 'tv',
    providerIds: number[],
    region: string,
    sortBy: string,
    extra: Record<string, string>,
    genreIds: number[] = [],
  ): Observable<TmdbResult[]> {
    const key = [
      'discover',
      type,
      region,
      [...providerIds].sort((a, b) => a - b).join(','),
      sortBy,
      [...genreIds].sort((a, b) => a - b).join(','),
      JSON.stringify(extra),
    ].join(':');
    return this.cached(
      key,
      TMDB_TTL.browse,
      this.http
        .get<{ results: TmdbResult[] }>(`${this.baseUrl}/discover/${type}`, {
          headers: this.headers,
          params: {
            watch_region: region,
            with_watch_providers: providerIds.join('|'),
            sort_by: sortBy,
            page: '1',
            ...(genreIds.length ? { with_genres: genreIds.join('|') } : {}),
            ...extra,
          },
        })
        .pipe(
          timeout(5000),
          map((res) => res.results.map((r) => ({ ...r, media_type: type }))),
        ),
    ).pipe(catchError(() => of([])));
  }

  private cached<T>(key: string, ttl: number, source: Observable<T>): Observable<T> {
    const hit = tmdbCacheGet<T>(key);
    if (hit !== undefined) return of(hit);
    return source.pipe(tap((data) => tmdbCacheSet(key, data, ttl)));
  }

  getProviderLogoUrl(logoPath: string): string {
    return `${environment.tmdb.imageBaseUrl}${logoPath}`;
  }

  getPosterUrl(posterPath: string | null, size: 'w200' | 'w300' | 'w500' = 'w500'): string {
    if (!posterPath) return 'assets/no-poster.png';
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }
}
