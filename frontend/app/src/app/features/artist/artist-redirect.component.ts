import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-artist-redirect',
  standalone: true,
  template: '',
})
export class ArtistRedirectComponent {
  private static readonly LAST_ARTIST_KEY = 'last.artist.browseId';
  private readonly router = inject(Router);

  constructor() {
    const lastId = (sessionStorage.getItem(ArtistRedirectComponent.LAST_ARTIST_KEY) ?? '').trim();
    if (lastId) {
      void this.router.navigate(['/artists', lastId], { replaceUrl: true });
      return;
    }
    void this.router.navigate(['/'], { replaceUrl: true });
  }
}
