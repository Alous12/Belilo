import { inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

const KEY = 'belilo_admin_entry';

@Injectable({ providedIn: 'root' })
export class AdminEntryService {
  canEnter(): boolean {
    return sessionStorage.getItem(KEY) === '1';
  }

  grant(): void {
    sessionStorage.setItem(KEY, '1');
  }
}

export const adminEntryGuard: CanActivateFn = () => {
  const entry = inject(AdminEntryService);
  const auth = inject(AdminAuthService);
  return entry.canEnter() || !!auth.token() ? true : inject(Router).createUrlTree(['/inicio']);
};
