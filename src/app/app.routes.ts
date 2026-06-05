import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'auth',
    loadComponent: () =>
      import('@pages/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'game',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@pages/game/game-canvas.component').then((m) => m.GameCanvasComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
