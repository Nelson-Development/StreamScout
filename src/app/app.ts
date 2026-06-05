import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from '@core/services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  supabase = inject(SupabaseService);
  router   = inject(Router);
  menuOpen = signal(false);

  async signOut() {
    await this.supabase.signOut();
    this.menuOpen.set(false);
    this.router.navigate(['/auth']);
  }

  closeMenu() { this.menuOpen.set(false); }
}
