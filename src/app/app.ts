import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LibraryService } from '@core/services/library.service';
import { LoaderService } from '@core/services/loader.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private library = inject(LibraryService);
  router = inject(Router);
  loader = inject(LoaderService);
  menuOpen = signal(false);
  shared = signal(false);

  ngOnInit() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuOpen.set(false));

    // Dismiss the splash as soon as the shell is up. It must not wait on network.
    this.shared.set(this.library.consumeShareFromLocation());
    this.loader.done();
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}
