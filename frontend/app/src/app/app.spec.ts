import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { App } from './app';
import { SearchRouteReuseStrategy } from './core/router/search-route-reuse.strategy';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // Mirrors app.config.ts: AuthService injects SearchRouteReuseStrategy,
      // which the application binds to the router's RouteReuseStrategy token.
      providers: [
        provideRouter([]),
        SearchRouteReuseStrategy,
        { provide: RouteReuseStrategy, useExisting: SearchRouteReuseStrategy },
        provideHttpClient(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
