import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const KEY = 'belilo_admin_token';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  readonly token = signal(sessionStorage.getItem(KEY) ?? '');

  verify(token: string): Observable<{ authenticated: boolean }> {
    return this.http.get<{ authenticated: boolean }>(`${environment.apiUrl}/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  save(token: string): void {
    sessionStorage.setItem(KEY, token);
    this.token.set(token);
  }

  clear(): void {
    sessionStorage.removeItem(KEY);
    this.token.set('');
  }
}
