import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: 'inicio', loadComponent: () => import('./features/home/home').then(m => m.Home) },
  { path: 'carrito', loadComponent: () => import('./features/cart/cart').then(m => m.Cart) },
  { path: 'compra', loadComponent: () => import('./features/checkout/checkout').then(m => m.Checkout) },
  { path: 'admin', loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
  { path: '**', redirectTo: 'inicio' },
];
