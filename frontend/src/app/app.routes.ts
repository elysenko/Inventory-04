import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { ShellComponent } from './shell/shell.component';

/**
 * Every screen is deep-linkable at its own URL, and every filter/wizard state
 * lives in query params rather than component memory, so a reviewer can open
 * any state directly.
 */
export const routes: Routes = [
  {
    path: 'login',
    data: { flow: 'auth', title: 'Sign in' },
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    data: { flow: 'auth', title: 'Create account' },
    loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'items' },
      {
        path: 'items',
        data: { flow: 'catalog', title: 'Items' },
        loadComponent: () => import('./pages/items/item-list/item-list.component').then((m) => m.ItemListComponent),
      },
      {
        path: 'items/new',
        canActivate: [roleGuard('manager')],
        data: { flow: 'catalog', title: 'New item' },
        loadComponent: () => import('./pages/items/item-form/item-form.component').then((m) => m.ItemFormComponent),
      },
      {
        path: 'items/:id',
        data: { flow: 'catalog', title: 'Item detail' },
        loadComponent: () => import('./pages/items/item-detail/item-detail.component').then((m) => m.ItemDetailComponent),
      },
      {
        path: 'items/:id/edit',
        canActivate: [roleGuard('manager')],
        data: { flow: 'catalog', title: 'Edit item' },
        loadComponent: () => import('./pages/items/item-form/item-form.component').then((m) => m.ItemFormComponent),
      },
      {
        path: 'locations',
        canActivate: [roleGuard('manager')],
        data: { flow: 'locations', title: 'Locations' },
        loadComponent: () =>
          import('./pages/locations/location-list/location-list.component').then((m) => m.LocationListComponent),
      },
      {
        path: 'locations/new',
        canActivate: [roleGuard('manager')],
        data: { flow: 'locations', title: 'New location' },
        loadComponent: () =>
          import('./pages/locations/location-form/location-form.component').then((m) => m.LocationFormComponent),
      },
      {
        path: 'locations/:id/edit',
        canActivate: [roleGuard('manager')],
        data: { flow: 'locations', title: 'Edit location' },
        loadComponent: () =>
          import('./pages/locations/location-form/location-form.component').then((m) => m.LocationFormComponent),
      },
      {
        path: 'movements/new',
        data: { flow: 'movements', title: 'Record movement' },
        loadComponent: () =>
          import('./pages/movements/movement-form/movement-form.component').then((m) => m.MovementFormComponent),
      },
      {
        path: 'movements',
        canActivate: [roleGuard('manager')],
        data: { flow: 'movements', title: 'Movement log' },
        loadComponent: () =>
          import('./pages/movements/movement-log/movement-log.component').then((m) => m.MovementLogComponent),
      },
      {
        path: 'reports/low-stock',
        canActivate: [roleGuard('manager')],
        data: { flow: 'reports', title: 'Low stock' },
        loadComponent: () => import('./pages/reports/low-stock/low-stock.component').then((m) => m.LowStockComponent),
      },
      {
        path: 'admin/settings',
        canActivate: [roleGuard('manager')],
        data: { flow: 'admin', title: 'System settings' },
        loadComponent: () => import('./pages/admin/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'items' },
];
