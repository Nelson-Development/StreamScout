import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('@pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('@pages/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('@pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
