import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AlbumComponent } from './features/album/album.component';
import { AlbumRedirectComponent } from './features/album/album-redirect.component';
import { ArtistComponent } from './features/artist/artist.component';
import { ArtistRedirectComponent } from './features/artist/artist-redirect.component';
import { ClipComponent } from './features/clip/clip.component';
import { FavoritesComponent } from './features/favorites/favorites.component';
import { HistoryComponent } from './features/history/history.component';
import { HomeComponent } from './features/home/home.component';
import { MoodComponent } from './features/mood/mood.component';
import { PlaylistDetailComponent } from './features/playlists/playlist-detail/playlist-detail.component';
import { PlaylistsComponent } from './features/playlists/playlists.component';
import { PersonalMixComponent } from './features/personal-mix/personal-mix.component';
import { ProfileComponent } from './features/profile/profile.component';
import { SearchComponent } from './features/search/search.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'clip/:code', component: ClipComponent },
  { path: 'search', component: SearchComponent, canActivate: [authGuard] },
  { path: 'albums', component: AlbumRedirectComponent, canActivate: [authGuard] },
  { path: 'albums/:browseId', component: AlbumComponent, canActivate: [authGuard] },
  { path: 'artists', component: ArtistRedirectComponent, canActivate: [authGuard] },
  { path: 'artists/:browseId', component: ArtistComponent, canActivate: [authGuard] },
  { path: 'playlists', component: PlaylistsComponent, canActivate: [authGuard] },
  { path: 'playlists/:id', component: PlaylistDetailComponent, canActivate: [authGuard] },
  { path: 'mixes/:id', component: PlaylistDetailComponent, canActivate: [authGuard] },
  { path: 'personal-mix', component: PersonalMixComponent, canActivate: [authGuard] },
  { path: 'favorites', component: FavoritesComponent, canActivate: [authGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
  { path: 'mood', component: MoodComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
