import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { WatchlistItem } from '@core/services/library.service';
import { TmdbService } from '@core/services/tmdb.service';

type Phase = 'select' | 'spin' | 'result';

@Component({
  selector: 'app-watchlist-picker',
  standalone: true,
  templateUrl: './watchlist-picker.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './watchlist-picker.component.scss',
})
export class WatchlistPickerComponent {
  private tmdb = inject(TmdbService);

  items = input.required<WatchlistItem[]>();
  closed = output<void>();

  @ViewChild('reelStrip') reelStripRef!: ElementRef<HTMLDivElement>;

  checkedIds = signal<Set<string>>(new Set());
  phase = signal<Phase>('select');
  reelItems = signal<WatchlistItem[]>([]);
  winner = signal<WatchlistItem | null>(null);
  winnerReelIndex = -1;

  // Item width (poster 100px) + gap (8px)
  private readonly ITEM_W = 108;
  private readonly COPIES = 8;

  ngOnInit() {
    // Pre-select all items
    this.checkedIds.set(new Set(this.items().map((i) => this.itemKey(i))));
  }

  itemKey(item: WatchlistItem) {
    return `${item.media_type}:${item.movie_id}`;
  }
  selectedItems() {
    return this.items().filter((i) => this.checkedIds().has(this.itemKey(i)));
  }
  selectedCount() {
    return this.selectedItems().length;
  }
  isChecked(key: string) {
    return this.checkedIds().has(key);
  }

  toggle(key: string) {
    this.checkedIds.update((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  selectAll() {
    this.checkedIds.set(new Set(this.items().map((i) => this.itemKey(i))));
  }
  deselectAll() {
    this.checkedIds.set(new Set());
  }

  spin() {
    const selected = this.selectedItems();
    if (selected.length < 1) return;

    // Build reel from COPIES repetitions
    const reel: WatchlistItem[] = [];
    for (let i = 0; i < this.COPIES; i++) reel.push(...selected);
    this.reelItems.set(reel);

    // Pick winner
    const winnerItem = selected[Math.floor(Math.random() * selected.length)];
    this.winner.set(winnerItem);

    // Find the winner's index in the last 25–60% of the reel
    const lo = Math.floor(reel.length * 0.45);
    const hi = Math.floor(reel.length * 0.72);
    const candidates: number[] = [];
    for (let i = lo; i < hi; i++) {
      if (this.itemKey(reel[i]) === this.itemKey(winnerItem)) candidates.push(i);
    }
    this.winnerReelIndex = candidates[Math.floor(Math.random() * candidates.length)] ?? lo;

    this.phase.set('spin');

    // Wait one tick for DOM to render reel, then animate
    setTimeout(() => {
      const el = this.reelStripRef.nativeElement;
      const containerWidth = (el.parentElement as HTMLElement).clientWidth;
      const finalX = containerWidth / 2 - this.ITEM_W / 2 - this.winnerReelIndex * this.ITEM_W;

      el.style.transition = 'none';
      el.style.transform = 'translateX(0)';
      void el.offsetWidth; // force reflow so transition reset takes effect

      el.style.transition = 'transform 6s cubic-bezier(0.06, 0.85, 0.18, 1)';
      el.style.transform = `translateX(${finalX}px)`;
    }, 60);

    // Show result once animation finishes
    setTimeout(() => this.phase.set('result'), 6700);
  }

  reset() {
    this.phase.set('select');
    this.winner.set(null);
    this.reelItems.set([]);
  }

  getPosterUrl(path: string) {
    return this.tmdb.getPosterUrl(path, 'w200');
  }
  onImageError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img.dataset['posterFallback'] === '1') return;
    img.dataset['posterFallback'] = '1';
    img.src = 'assets/no-poster.png';
  }
}
