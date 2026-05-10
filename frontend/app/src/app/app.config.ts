import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { AppSettingsService } from './core/services/app-settings.service';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { rateLimitInterceptor } from './core/interceptors/rate-limit.interceptor';
import { SearchRouteReuseStrategy } from './core/router/search-route-reuse.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: SearchRouteReuseStrategy },
    provideHttpClient(withInterceptors([jwtInterceptor, rateLimitInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AppSettingsService],
      useFactory: () => () => undefined,
    },
  ],
};
