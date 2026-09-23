import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';

export const adminAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.split('?')[0];
  const adminRequest =
    (request.method === 'POST' && (path.endsWith('/products') || path.endsWith('/images'))) ||
    ((request.method === 'PUT' || request.method === 'DELETE') && /\/products\/[^/]+$/.test(path)) ||
    (request.method === 'PUT' && path.endsWith('/delivery-settings')) ||
    (request.method === 'GET' && path.endsWith('/orders')) ||
    (request.method === 'PATCH' && /\/orders\/[^/]+\/status$/.test(path));

  const token = inject(AdminAuthService).token();
  return next(adminRequest && token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};
