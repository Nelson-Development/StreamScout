import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, EMPTY, of, Subject, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TmdbService, SearchResult } from '@core/services/tmdb.service';
import { SupabaseService, WatchlistItem } from '@core/services/supabase.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private tmdb = inject(TmdbService);
  private supabase = inject(SupabaseService);

  query = '';
  results = signal<SearchResult[]>([]);
  loading = signal(false);
  userProviders = signal<number[]>([]);

  private search$ = new Subject<string>();

  constructor() {
    const user = this.supabase.currentUser();
    if (user) {
      this.supabase.getUserServices(user.id).then((ids) => this.userProviders.set(ids)).catch(() => {});
    }

    this.search$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) {
            this.results.set([]);
            this.loading.set(false);
            return EMPTY;
          }
          this.loading.set(true);
          return this.tmdb.searchWithProviders(q, this.userProviders()).pipe(
            catchError(() => {
              this.loading.set(false);
              return of([]);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((results) => {
        this.results.set(results);
        this.loading.set(false);
      });
  }

  onInput() {
    this.search$.next(this.query);
  }

  getPosterUrl(posterPath: string | null): string {
    return this.tmdb.getPosterUrl(posterPath, 'w300');
  }

  getLogoUrl(logoPath: string): string {
    return this.tmdb.getProviderLogoUrl(logoPath);
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/no-poster.png';
  }

  onLogoError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  async addToWatchlist(result: SearchResult) {
    const user = this.supabase.currentUser();
    if (!user) return;

    const item: WatchlistItem = {
      user_id: user.id,
      movie_id: result.id,
      title: result.displayTitle,
      poster_path: result.poster_path ?? '',
      media_type: result.media_type as 'movie' | 'tv',
    };
    try {
      await this.supabase.addToWatchlist(item);
    } catch {}
  }
}
