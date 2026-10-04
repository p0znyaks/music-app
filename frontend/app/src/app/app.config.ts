import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { rateLimitInterceptor } from './core/interceptors/rate-limit.interceptor';
import { SearchRouteReuseStrategy } from './core/router/search-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    SearchRouteReuseStrategy,
    { provide: RouteReuseStrategy, useExisting: SearchRouteReuseStrategy },
    provideHttpClient(withInterceptors([jwtInterceptor, rateLimitInterceptor])),
  ],
};
