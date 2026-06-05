import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '@core/services/supabase.service';
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
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private tmdb = inject(TmdbService);

  readonly regions = SUPPORTED_REGIONS;

  providers = signal<StreamingProvider[]>([]);
  selectedRegion = signal<string>('ZA');
  saving = signal(false);
  savedMessage = signal(false);
  saveError = signal(false);
  loadingProviders = signal(false);

  async ngOnInit() {
    const user = this.supabase.currentUser();
    if (!user) return;

    this.selectedRegion.set(this.tmdb.region());

    try {
      const [saved, tmdbProviders] = await Promise.all([
        this.supabase.getUserServices(user.id),
        firstValueFrom(this.tmdb.getProvidersForRegion(this.selectedRegion())),
      ]);
      this.providers.set(
        tmdbProviders.map((p) => ({
          id: p.provider_id,
          name: p.provider_name,
          logo: p.logo_path,
          selected: saved.includes(p.provider_id),
        }))
      );
    } catch {
      // providers stays empty
    }
  }

  onRegionChange(code: string) {
    if (code === this.selectedRegion()) return;
    this.selectedRegion.set(code);
    this.loadingProviders.set(true);
    this.tmdb.getProvidersForRegion(code).subscribe({
      next: (tmdbProviders) => {
        this.providers.set(
          tmdbProviders.map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logo: p.logo_path,
            selected: false,
          }))
        );
        this.loadingProviders.set(false);
      },
      error: () => this.loadingProviders.set(false),
    });
  }

  toggle(id: number) {
    this.providers.update((list) =>
      list.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }

  async save() {
    const user = this.supabase.currentUser();
    if (!user) return;

    this.saving.set(true);
    this.saveError.set(false);
    const selected = this.providers().filter((p) => p.selected).map((p) => p.id);

    try {
      this.tmdb.setRegion(this.selectedRegion());
      await this.supabase.setUserServices(user.id, selected);
      this.savedMessage.set(true);
      setTimeout(() => this.savedMessage.set(false), 2000);
    } catch {
      this.saveError.set(true);
      setTimeout(() => this.saveError.set(false), 3000);
    } finally {
      this.saving.set(false);
    }
  }

  getLogoUrl(logoPath: string): string {
    return this.tmdb.getProviderLogoUrl(logoPath);
  }
}
