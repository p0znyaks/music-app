import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { PlayerService } from './core/services/player.service';
import { ToastService } from './core/services/toast.service';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { PlayerComponent } from './features/player/player.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, PlayerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);
  protected readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser$.value });
  protected readonly playerTrack = toSignal(this.player.currentTrack$, { initialValue: null });

  private readonly isClipRoute$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(() => this.router.url.startsWith('/clip/')),
    startWith(this.router.url.startsWith('/clip/')),
  );
  protected readonly isClipRoute = toSignal(this.isClipRoute$, { initialValue: this.router.url.startsWith('/clip/') });
}
