import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-album-redirect',
  standalone: true,
  template: '',
})
export class AlbumRedirectComponent {
  private static readonly LAST_ALBUM_KEY = 'last.album.browseId';
  private readonly router = inject(Router);

  constructor() {
    const lastId = (sessionStorage.getItem(AlbumRedirectComponent.LAST_ALBUM_KEY) ?? '').trim();
    if (lastId) {
      void this.router.navigate(['/albums', lastId], { replaceUrl: true });
      return;
    }
    void this.router.navigate(['/'], { replaceUrl: true });
  }
}
