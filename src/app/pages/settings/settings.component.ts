import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LibraryService } from '@core/services/library.service';
import { TmdbService, SUPPORTED_REGIONS } from '@core/services/tmdb.service';

interface StreamingProvider {
  id: number;
  name: string;
  logo: string;
  selected: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private library = inject(LibraryService);
  private tmdb = inject(TmdbService);

  readonly regions = SUPPORTED_REGIONS;

  providers = signal<StreamingProvider[]>([]);
  selectedRegion = signal<string>('ZA');
  saving = signal(false);
  savedMessage = signal(false);
  saveError = signal(false);
  loadingProviders = signal(false);
  dataMessage = signal('');
  dataError = signal('');
  shareLink = signal('');

  async ngOnInit() {
    const user = this.library.currentUser();
    if (!user) return;

    this.selectedRegion.set(this.tmdb.region());
    const saved = await this.library.getUserServices(user.id);
    await this.loadProviders(this.selectedRegion(), saved);
  }

  onRegionChange(code: string) {
    if (code === this.selectedRegion()) return;
    this.selectedRegion.set(code);
    void this.loadProviders(code, []);
  }

  toggle(id: number) {
    this.providers.update((list) =>
      list.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    );
  }

  async save() {
    const user = this.library.currentUser();
    if (!user) return;

    this.saving.set(true);
    this.saveError.set(false);
    const selected = this.providers()
      .filter((p) => p.selected)
      .map((p) => p.id);

    try {
      this.tmdb.setRegion(this.selectedRegion());
      await this.library.setUserServices(user.id, selected);
      this.savedMessage.set(true);
      setTimeout(() => this.savedMessage.set(false), 2000);
    } catch {
      this.saveError.set(true);
      setTimeout(() => this.saveError.set(false), 3000);
    } finally {
      this.saving.set(false);
    }
  }

  exportFile() {
    const blob = new Blob([this.library.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'streamscout-library.json';
    anchor.click();
    URL.revokeObjectURL(url);
    this.dataError.set('');
    this.dataMessage.set('Downloaded streamscout-library.json');
  }

  async onImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.dataMessage.set('');
    this.dataError.set('');
    try {
      const snapshot = this.library.importJson(await file.text());
      this.tmdb.setRegion(snapshot.region);
      this.selectedRegion.set(snapshot.region);
      await this.loadProviders(snapshot.region, snapshot.services);
      this.shareLink.set('');
      this.dataMessage.set('Imported services and watchlist.');
    } catch {
      this.dataError.set('Could not read that file. Choose a StreamScout export.');
    }
  }

  async copyShareLink() {
    const url = `${location.origin}${location.pathname}${location.search}#s=${this.library.shareToken()}`;
    this.shareLink.set(url);
    this.dataError.set('');
    try {
      await navigator.clipboard.writeText(url);
      this.dataMessage.set('Share link copied.');
    } catch {
      this.dataMessage.set('Share link is ready — copy it from the field below.');
    }
  }

  selectShare(event: Event) {
    (event.target as HTMLInputElement).select();
  }

  getLogoUrl(logoPath: string): string {
    return this.tmdb.getProviderLogoUrl(logoPath);
  }

  private async loadProviders(region: string, selectedIds: number[]) {
    this.loadingProviders.set(true);
    try {
      const tmdbProviders = await firstValueFrom(this.tmdb.getProvidersForRegion(region));
      this.providers.set(
        tmdbProviders.map((p) => ({
          id: p.provider_id,
          name: p.provider_name,
          logo: p.logo_path,
          selected: selectedIds.includes(p.provider_id),
        })),
      );
    } catch {
      this.providers.set([]);
    } finally {
      this.loadingProviders.set(false);
    }
  }
}
