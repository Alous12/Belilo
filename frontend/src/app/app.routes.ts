import { Routes } from '@angular/router';
import { adminEntryGuard } from './core/admin-entry.service';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: 'inicio', loadComponent: () => import('./features/home/home').then(m => m.Home) },
  { path: 'carrito', redirectTo: 'inicio' },
  { path: 'compra', redirectTo: 'inicio' },
  { path: 'admin', canActivate: [adminEntryGuard], loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
  { path: '**', redirectTo: 'inicio' },
];
