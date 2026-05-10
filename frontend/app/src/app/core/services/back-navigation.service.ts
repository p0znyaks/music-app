import { Location } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  back(fallbackUrl: string = '/'): void {
    const sectionBackUrl = this.resolveSectionBackUrl();
    if (sectionBackUrl) {
      void this.router.navigateByUrl(sectionBackUrl);
      return;
    }
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(fallbackUrl);
  }

  private resolveSectionBackUrl(): string | null {
    const state = history.state as { sectionBackUrl?: unknown } | null;
    if (!state || typeof state.sectionBackUrl !== 'string') {
      return null;
    }
    const value = state.sectionBackUrl.trim();
    return value ? value : null;
  }
}
