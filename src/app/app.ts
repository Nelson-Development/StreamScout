import { Component, inject, signal, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '@core/services/supabase.service';
import { LoaderService } from '@core/services/loader.service';
import { FeedbackButtonComponent } from '@core/components/feedback/feedback-button.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FeedbackButtonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  supabase    = inject(SupabaseService);
  router      = inject(Router);
  loader      = inject(LoaderService);
  menuOpen    = signal(false);
  currentUrl  = signal(this.router.url);

  async ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => this.currentUrl.set((e as NavigationEnd).urlAfterRedirects));

    await this.supabase.waitForSession();
    this.loader.done();
  }

  async signOut() {
    await this.supabase.signOut();
    this.menuOpen.set(false);
    this.router.navigate(['/auth']);
  }

  closeMenu() { this.menuOpen.set(false); }
}
