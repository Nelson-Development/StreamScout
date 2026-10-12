import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { TmdbService, TmdbResult, Genre } from '@core/services/tmdb.service';
import { LibraryService, WatchlistItem } from '@core/services/library.service';
import { WatchlistPickerComponent } from './watchlist-picker/watchlist-picker.component';

export interface ContentSection {
  title: string;
  items: TmdbResult[];
}
export interface WatchlistDisplayItem extends WatchlistItem {
  isAvailableNow: boolean;
}

interface SectionLoad {
  providerIds: number[];
  myServicesOnly: boolean;
  genreIds: number[];
}

interface SectionResults {
  movieTrending: TmdbResult[];
  moviePopular: TmdbResult[];
  movieTopRated: TmdbResult[];
  movieNowPlaying: TmdbResult[];
  tvTrending: TmdbResult[];
  tvPopular: TmdbResult[];
  tvTopRated: TmdbResult[];
  tvOnAir: TmdbResult[];
  movieOnServices: TmdbResult[];
  tvOnServices: TmdbResult[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [WatchlistPickerComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private tmdb = inject(TmdbService);
  private library = inject(LibraryService);
  private readonly loadRequest$ = new Subject<SectionLoad>();

  activeTab = signal<'movie' | 'tv'>('movie');
  myServicesOnly = signal(false);
  pickerOpen = signal(false);
  movieSections = signal<ContentSection[]>([]);
  tvSections = signal<ContentSection[]>([]);
  watchlist = signal<WatchlistDisplayItem[]>([]);
  userProviders = signal<number[]>([]);
  loading = signal(true);
  genres = signal<Genre[]>([]);
  selectedGenres = signal<number[]>([]);
  genreDropdownOpen = signal(false);
  hoveredKey = signal<string | null>(null);
  hoveredProviders = signal<{ provider_id: number; provider_name: string; logo_path: string }[]>(
    [],
  );
  hoveredLoaded = signal(false);
  private providerCache = new Map<
    string,
    { provider_id: number; provider_name: string; logo_path: string }[]
  >();

  sections = computed(() =>
    this.activeTab() === 'movie' ? this.movieSections() : this.tvSections(),
  );

  hasAnyContent = computed(() => this.sections().some((s) => s.items.length > 0));

  selectedGenreLabels = computed(() => {
    const ids = this.selectedGenres();
    return this.genres()
      .filter((g) => ids.includes(g.id))
      .map((g) => g.name);
  });

  constructor() {
    this.loadRequest$
      .pipe(
        switchMap((req) =>
          this.fetchSections(req).pipe(
            catchError(() => {
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.applySections(r));
  }

  async ngOnInit() {
    const user = this.library.currentUser();
    if (!user) return;
    try {
      const [watchlistItems, providerIds] = await Promise.all([
        this.library.getWatchlist(user.id),
        this.library.getUserServices(user.id),
      ]);
      this.userProviders.set(providerIds);
      await this.loadWatchlist(watchlistItems, providerIds);
      this.tmdb.getGenres('movie').subscribe((g) => this.genres.set(g));
      this.loadSections(providerIds, false, []);
    } catch {
      this.loading.set(false);
    }
  }

  setTab(tab: 'movie' | 'tv') {
    this.activeTab.set(tab);
    this.selectedGenres.set([]);
    this.genreDropdownOpen.set(false);
    this.tmdb.getGenres(tab).subscribe((g) => this.genres.set(g));
    this.loading.set(true);
    this.loadSections(this.userProviders(), this.myServicesOnly(), []);
  }

  toggleMyServices() {
    const next = !this.myServicesOnly();
    this.myServicesOnly.set(next);
    this.loading.set(true);
    this.loadSections(this.userProviders(), next, this.selectedGenres());
  }

  toggleGenre(id: number) {
    this.selectedGenres.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
    this.loading.set(true);
    this.loadSections(this.userProviders(), this.myServicesOnly(), this.selectedGenres());
  }

  clearGenres() {
    this.selectedGenres.set([]);
    this.loading.set(true);
    this.loadSections(this.userProviders(), this.myServicesOnly(), []);
  }

  private async loadWatchlist(items: WatchlistItem[], providerIds: number[]) {
    if (items.length === 0) {
      this.watchlist.set([]);
      return;
    }
    const checks = items.map((item) =>
      this.tmdb.getWatchProviders(item.movie_id, item.media_type).pipe(
        map(
          (providers) =>
            ({
              ...item,
              isAvailableNow: providers.some((p) => providerIds.includes(p.provider_id)),
            }) as WatchlistDisplayItem,
        ),
        catchError(() => of({ ...item, isAvailableNow: false } as WatchlistDisplayItem)),
      ),
    );
    forkJoin(checks).subscribe((enriched) => this.watchlist.set(enriched));
  }

  private loadSections(providerIds: number[], myServicesOnly: boolean, genreIds: number[]) {
    this.loading.set(true);
    this.loadRequest$.next({ providerIds, myServicesOnly, genreIds });
  }

  private fetchSections(req: SectionLoad): Observable<SectionResults> {
    const { providerIds, myServicesOnly, genreIds } = req;
    const hasGenres = genreIds.length > 0;

    const d = (t: 'movie' | 'tv', sort: string, extra?: Record<string, string>) =>
      this.tmdb.discover(t, providerIds, sort, extra ?? {}, genreIds);

    const src = (
      t: 'movie' | 'tv',
      sort: string,
      def: () => Observable<TmdbResult[]>,
    ): Observable<TmdbResult[]> =>
      myServicesOnly
        ? d(t, sort)
        : hasGenres
          ? this.tmdb.discoverByGenre(t, genreIds, sort)
          : def();

    return forkJoin({
      movieTrending: src('movie', 'popularity.desc', () => this.tmdb.getTrending('movie')),
      moviePopular:
        myServicesOnly || hasGenres
          ? of([] as TmdbResult[])
          : this.tmdb.getList('movie', 'popular'),
      movieTopRated: myServicesOnly
        ? d('movie', 'vote_average.desc', { 'vote_count.gte': '200' })
        : hasGenres
          ? this.tmdb.discoverByGenre('movie', genreIds, 'vote_average.desc')
          : this.tmdb.getList('movie', 'top_rated'),
      movieNowPlaying:
        myServicesOnly || hasGenres
          ? of([] as TmdbResult[])
          : this.tmdb.getList('movie', 'now_playing'),
      tvTrending: src('tv', 'popularity.desc', () => this.tmdb.getTrending('tv')),
      tvPopular:
        myServicesOnly || hasGenres ? of([] as TmdbResult[]) : this.tmdb.getList('tv', 'popular'),
      tvTopRated: myServicesOnly
        ? d('tv', 'vote_average.desc', { 'vote_count.gte': '200' })
        : hasGenres
          ? this.tmdb.discoverByGenre('tv', genreIds, 'vote_average.desc')
          : this.tmdb.getList('tv', 'top_rated'),
      tvOnAir:
        myServicesOnly || hasGenres
          ? of([] as TmdbResult[])
          : this.tmdb.getList('tv', 'on_the_air'),
      movieOnServices:
        !myServicesOnly && providerIds.length
          ? this.tmdb.getOnServices('movie', providerIds, genreIds)
          : of([] as TmdbResult[]),
      tvOnServices:
        !myServicesOnly && providerIds.length
          ? this.tmdb.getOnServices('tv', providerIds, genreIds)
          : of([] as TmdbResult[]),
    });
  }

  private applySections(r: SectionResults) {
    this.movieSections.set([
      ...(r.movieOnServices.length
        ? [{ title: 'On Your Services', items: r.movieOnServices }]
        : []),
      { title: 'Trending This Week', items: r.movieTrending },
      ...(r.moviePopular.length ? [{ title: 'Popular Right Now', items: r.moviePopular }] : []),
      { title: 'Top Rated', items: r.movieTopRated },
      ...(r.movieNowPlaying.length ? [{ title: 'Now in Cinemas', items: r.movieNowPlaying }] : []),
    ]);
    this.tvSections.set([
      ...(r.tvOnServices.length ? [{ title: 'On Your Services', items: r.tvOnServices }] : []),
      { title: 'Trending This Week', items: r.tvTrending },
      ...(r.tvPopular.length ? [{ title: 'Popular Right Now', items: r.tvPopular }] : []),
      { title: 'Top Rated', items: r.tvTopRated },
      ...(r.tvOnAir.length ? [{ title: 'Currently Airing', items: r.tvOnAir }] : []),
    ]);
    this.loading.set(false);
  }

  async addToWatchlist(item: TmdbResult) {
    const user = this.library.currentUser();
    if (!user) return;
    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
    const entry: WatchlistItem = {
      user_id: user.id,
      movie_id: item.id,
      title: item.title ?? item.name ?? '',
      poster_path: item.poster_path ?? '',
      media_type: mediaType,
    };
    try {
      await this.library.addToWatchlist(entry);
      this.watchlist.update((list) => {
        if (list.some((w) => w.movie_id === entry.movie_id && w.media_type === entry.media_type)) {
          return list;
        }
        return [...list, { ...entry, isAvailableNow: false }];
      });
    } catch {
      // Keep the current list if storage is unavailable.
    }
  }

  async removeFromWatchlist(item: WatchlistDisplayItem) {
    const user = this.library.currentUser();
    if (!user) return;
    try {
      await this.library.removeFromWatchlist(user.id, item.movie_id, item.media_type);
      this.watchlist.update((list) =>
        list.filter((w) => !(w.movie_id === item.movie_id && w.media_type === item.media_type)),
      );
    } catch {
      // Leave the row in place if storage is unavailable.
    }
  }

  onHover(id: number, mediaType: string) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const key = this.mediaKey(id, type);
    this.hoveredKey.set(key);
    const cached = this.providerCache.get(key);
    if (cached !== undefined) {
      this.hoveredProviders.set(cached);
      this.hoveredLoaded.set(true);
      return;
    }
    this.hoveredProviders.set([]);
    this.hoveredLoaded.set(false);
    this.tmdb.getWatchProviders(id, type).subscribe((providers) => {
      this.providerCache.set(key, providers);
      if (this.hoveredKey() === key) {
        this.hoveredProviders.set(providers);
        this.hoveredLoaded.set(true);
      }
    });
  }

  onLeave() {
    this.hoveredKey.set(null);
    this.hoveredProviders.set([]);
    this.hoveredLoaded.set(false);
  }

  onCardTap(id: number, mediaType: string) {
    if (!window.matchMedia('(hover: none)').matches) return;
    const key = this.mediaKey(id, mediaType === 'tv' ? 'tv' : 'movie');
    if (this.hoveredKey() === key) {
      this.onLeave();
    } else {
      this.onHover(id, mediaType);
    }
  }

  isHovered(id: number, mediaType: string) {
    return this.hoveredKey() === this.mediaKey(id, mediaType === 'tv' ? 'tv' : 'movie');
  }

  isGenreSelected(id: number) {
    return this.selectedGenres().includes(id);
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.dataset['posterFallback'] === '1') return;
    img.dataset['posterFallback'] = '1';
    img.src = 'assets/no-poster.png';
  }

  onLogoError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  getPosterUrl(path: string | null) {
    return this.tmdb.getPosterUrl(path, 'w200');
  }
  getLogoUrl(path: string) {
    return this.tmdb.getProviderLogoUrl(path);
  }
  getRating(item: TmdbResult) {
    return item.vote_average?.toFixed(1) ?? '';
  }
  getYear(item: TmdbResult) {
    return (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
  }
  getTitle(item: TmdbResult) {
    return item.title ?? item.name ?? '';
  }
  isInWatchlist(id: number, mediaType: string) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    return this.watchlist().some((w) => w.movie_id === id && w.media_type === type);
  }

  private mediaKey(id: number, mediaType: string) {
    return `${mediaType}:${id}`;
  }
}
