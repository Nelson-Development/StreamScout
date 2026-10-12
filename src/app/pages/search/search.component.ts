import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { debounceTime, EMPTY, of, Subject, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TmdbService, SearchResult } from '@core/services/tmdb.service';
import { LibraryService, WatchlistItem } from '@core/services/library.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './search.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private tmdb = inject(TmdbService);
  private library = inject(LibraryService);

  query = '';
  results = signal<SearchResult[]>([]);
  loading = signal(false);
  error = signal('');
  userProviders = signal<number[]>([]);
  savedKeys = signal<Set<string>>(new Set());

  private search$ = new Subject<string>();

  constructor() {
    const user = this.library.currentUser();
    if (user) {
      this.library
        .getUserServices(user.id)
        .then((ids) => this.userProviders.set(ids))
        .catch(() => {});
      this.library
        .getWatchlist(user.id)
        .then((items) => {
          this.savedKeys.set(
            new Set(items.map((item) => this.mediaKey(item.movie_id, item.media_type))),
          );
        })
        .catch(() => {});
    }

    this.search$
      .pipe(
        debounceTime(400),
        switchMap((q) => {
          if (!q.trim()) {
            this.results.set([]);
            this.loading.set(false);
            this.error.set('');
            return EMPTY;
          }
          this.loading.set(true);
          this.error.set('');
          return this.tmdb.searchWithProviders(q, this.userProviders()).pipe(
            catchError(() => {
              this.loading.set(false);
              this.error.set('Search failed. Check your connection and try again.');
              return of([] as SearchResult[]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.results.set(results);
        this.loading.set(false);
      });
  }

  onInput() {
    this.search$.next(this.query);
  }

  retry() {
    this.search$.next(this.query);
  }

  getPosterUrl(posterPath: string | null): string {
    return this.tmdb.getPosterUrl(posterPath, 'w300');
  }

  getLogoUrl(logoPath: string): string {
    return this.tmdb.getProviderLogoUrl(logoPath);
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

  isSaved(result: SearchResult): boolean {
    return this.savedKeys().has(this.mediaKey(result.id, result.media_type));
  }

  async addToWatchlist(result: SearchResult) {
    const user = this.library.currentUser();
    if (!user) return;
    const mediaType = result.media_type === 'tv' ? 'tv' : 'movie';
    if (this.savedKeys().has(this.mediaKey(result.id, mediaType))) return;

    const item: WatchlistItem = {
      user_id: user.id,
      movie_id: result.id,
      title: result.displayTitle,
      poster_path: result.poster_path ?? '',
      media_type: mediaType,
    };
    try {
      await this.library.addToWatchlist(item);
      this.savedKeys.update((keys) => {
        const next = new Set(keys);
        next.add(this.mediaKey(result.id, mediaType));
        return next;
      });
    } catch {
      this.error.set('Could not save that title on this device.');
    }
  }

  private mediaKey(id: number, mediaType: string): string {
    return `${mediaType === 'tv' ? 'tv' : 'movie'}:${id}`;
  }
}
