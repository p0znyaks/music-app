import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, type Params, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [AsyncPipe, TranslatePipe],
  template: `
    <aside class="sidebar">
      <a href="" class="logo" (click)="onLogoClick($event)">Muze</a>

      <nav class="nav">
        <a href="" class="nav-link" [class.active]="isSectionActive('search')" (click)="onSearchClick($event)">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
          </svg>
          {{ 'search' | t }}
        </a>
        <a href="" [class.active]="isSectionActive('playlists')" class="nav-link" (click)="onSectionClick($event, 'playlists')">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round" />
          </svg>
          {{ 'playlists' | t }}
        </a>
        <a href="" [class.active]="isSectionActive('favorites')" class="nav-link" (click)="onSectionClick($event, 'favorites')">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke-linejoin="round"
            />
          </svg>
          {{ 'favorites' | t }}
        </a>
        <a href="" [class.active]="isSectionActive('history')" class="nav-link" (click)="onSectionClick($event, 'history')">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" stroke-linecap="round" />
            <path d="M12 6V2L8 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ 'history' | t }}
        </a>
        <a href="" [class.active]="isSectionActive('mood')" class="nav-link" (click)="onSectionClick($event, 'mood')">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              stroke-linecap="round"
            />
          </svg>
          {{ 'tags' | t }}
        </a>
        <a href="" [class.active]="isSectionActive('profile')" class="nav-link" (click)="onSectionClick($event, 'profile')">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {{ 'profile' | t }}
        </a>
      </nav>

      <div class="footer">
        @if (auth.currentUser$ | async; as user) {
          <div class="user-email">{{ user.email }}</div>
        }
        <button type="button" class="logout" (click)="onLogout()">{{ 'logout' | t }}</button>
      </div>
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      width: 240px;
      height: 100vh;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 20;
      padding: 1.5rem 1rem;
    }
    .logo {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--accent);
      margin-bottom: 2rem;
    }
    .logo:hover {
      opacity: 0.9;
    }
    .nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      color: var(--accent-dim);
      font-size: 0.95rem;
    }
    .nav-link:hover {
      background: var(--bg-hover);
      color: var(--accent);
    }
    .nav-link.active {
      color: var(--accent);
      background: var(--bg-hover);
    }
    .ico {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .user-email {
      font-size: 0.8rem;
      color: var(--accent-dim);
      margin-bottom: 0.75rem;
      word-break: break-all;
    }
    .logout {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--accent-dim);
      cursor: pointer;
    }
    .logout:hover {
      border-color: var(--accent-dim);
      color: var(--accent);
    }
  `,
})
export class NavbarComponent {
  private static readonly SECTION_FALLBACK: Record<NavSection, string> = {
    search: '/search',
    playlists: '/playlists',
    favorites: '/favorites',
    history: '/history',
    mood: '/mood',
    profile: '/profile',
  };
  private static readonly SECTION_STORAGE_PREFIX = 'nav.lastUrl.';
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get searchQueryParams(): Params {
    const q = (sessionStorage.getItem('search.query') ?? '').trim();
    const tabRaw = (sessionStorage.getItem('search.tab') ?? '').trim();
    const tab = tabRaw === 'tracks' || tabRaw === 'albums' || tabRaw === 'artists' || tabRaw === 'all' ? tabRaw : '';

    const params: Params = {};
    if (q) {
      params['q'] = q;
    }
    if (tab) {
      params['tab'] = tab;
    }
    return params;
  }

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        const section = this.resolveSection(e.urlAfterRedirects);
        if (!section) {
          return;
        }
        sessionStorage.setItem(`${NavbarComponent.SECTION_STORAGE_PREFIX}${section}`, e.urlAfterRedirects);
      });
  }

  isSectionActive(section: NavSection): boolean {
    return this.resolveSection(this.router.url) === section;
  }

  onLogoClick(e: MouseEvent): void {
    e.preventDefault();
    sessionStorage.setItem('last.view', 'home');
    void this.router.navigateByUrl('/');
  }

  onSearchClick(e: MouseEvent): void {
    e.preventDefault();
    sessionStorage.setItem('last.view', 'search');
    this.openSection('search');
  }

  onSectionClick(e: MouseEvent, section: NavSection): void {
    e.preventDefault();
    this.openSection(section);
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private openSection(section: NavSection): void {
    const storedUrl = (sessionStorage.getItem(`${NavbarComponent.SECTION_STORAGE_PREFIX}${section}`) ?? '').trim();
    const sectionBackUrl = this.resolveSectionBackUrl(section);
    if (storedUrl) {
      void this.router.navigateByUrl(storedUrl, { state: { sectionBackUrl } });
      return;
    }

    if (section === 'search') {
      void this.router.navigate(['/search'], { queryParams: this.searchQueryParams });
      return;
    }

    void this.router.navigateByUrl(NavbarComponent.SECTION_FALLBACK[section]);
  }

  private resolveSectionBackUrl(section: NavSection): string {
    if (section !== 'search') {
      return NavbarComponent.SECTION_FALLBACK[section];
    }
    const queryParams = this.searchQueryParams;
    const tree = this.router.createUrlTree(['/search'], { queryParams });
    return this.router.serializeUrl(tree);
  }

  private resolveSection(url: string): NavSection | null {
    const path = url.split('?')[0] ?? '';
    const first = path.split('/').filter(Boolean)[0] ?? '';
    // Artist/album details belong to Search UX flow and should be restored
    // when user reopens the Search tab from the sidebar.
    if (first === 'artists' || first === 'albums') {
      return 'search';
    }
    if (
      first === 'search' ||
      first === 'playlists' ||
      first === 'favorites' ||
      first === 'history' ||
      first === 'mood' ||
      first === 'profile'
    ) {
      return first;
    }
    return null;
  }
}

type NavSection = 'search' | 'playlists' | 'favorites' | 'history' | 'mood' | 'profile';
