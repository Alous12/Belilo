import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ApiService } from './core/api.service';
import { CommerceRepository } from './core/commerce.repository';
import { adminAuthInterceptor } from './core/admin-auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(withInterceptors([adminAuthInterceptor])), provideRouter(routes), { provide: CommerceRepository, useClass: ApiService }],
};
