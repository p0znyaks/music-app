import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { isValidEmail } from '../../shared/utils/email.util';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page page--full">
      <div class="card card--form">
        <h1>{{ 'createAccount' | t }}</h1>
        <p class="sub">{{ 'joinMuze' | t }}</p>
        <form (ngSubmit)="submit()">
          <label>
            <span>{{ 'username' | t }}</span>
            <input
              type="text"
              name="username"
              [(ngModel)]="username"
              required
              autocomplete="username"
              (blur)="checkUsername()"
              [class.error]="usernameError()"
            />
            @if (usernameError(); as err) {
              <span class="field-err">{{ err }}</span>
            }
          </label>
          <label>
            <span>{{ 'email' | t }}</span>
            <input
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
              (blur)="checkEmail()"
              [class.error]="emailError()"
            />
            @if (emailError(); as err) {
              <span class="field-err">{{ err }}</span>
            }
          </label>
          <label>
            <span>{{ 'password' | t }}</span>
            <div class="pwd-wrap">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                name="password"
                [(ngModel)]="password"
                required
                autocomplete="new-password"
                (blur)="checkPassword()"
                [class.error]="passwordError()"
              />
              <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())">
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                }
              </button>
            </div>
            @if (passwordError(); as err) {
              <span class="field-err">{{ err }}</span>
            }
          </label>
          @if (error()) {
            <p class="error-text">{{ error() }}</p>
          }
          <button type="submit" class="primary" [disabled]="loading()">
            @if (loading()) {
              {{ 'loading' | t }}
            } @else {
              {{ 'register' | t }}
            }
          </button>
        </form>
        <p class="foot">
          {{ 'alreadyHaveAccount' | t }} <a routerLink="/login">{{ 'signIn' | t }}</a>
        </p>
      </div>
    </div>
  `,
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);

  username = '';
  email = '';
  password = '';

  loading = signal(false);
  error = signal('');
  usernameError = signal('');
  emailError = signal('');
  passwordError = signal('');
  showPassword = signal(false);

  constructor() {
    if (this.auth.isLoggedIn()) {
      void this.router.navigate(['/']);
    }
  }

  checkUsername(): void {
    const u = this.username.trim();
    if (!u) {
      this.usernameError.set(this.settings.t('usernameRequired'));
      return;
    }
    if (u.length < 3) {
      this.usernameError.set(this.settings.t('usernameTooShort'));
      return;
    }
    if (u.length > 20) {
      this.usernameError.set(this.settings.t('usernameTooLong'));
      return;
    }
    this.usernameError.set('');
  }

  checkEmail(): void {
    const e = this.email.trim();
    if (!e) {
      this.emailError.set(this.settings.t('emailRequired'));
      return;
    }
    if (!isValidEmail(e)) {
      this.emailError.set(this.settings.t('invalidEmail'));
      return;
    }
    this.emailError.set('');
  }

  checkPassword(): void {
    const p = this.password;
    if (!p) {
      this.passwordError.set(this.settings.t('passwordRequired'));
      return;
    }
    if (p.length < 3) {
      this.passwordError.set(this.settings.t('passwordTooShort'));
      return;
    }
    this.passwordError.set('');
  }

  submit(): void {
    this.checkUsername();
    this.checkEmail();
    this.checkPassword();

    if (this.usernameError() || this.emailError() || this.passwordError()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.register(this.username.trim(), this.email.trim(), this.password).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: (e) => {
        this.loading.set(false);
        const code = e?.error?.code ?? '';
        const msg = e?.error?.message ?? '';
        if (code === 'EMAIL_TAKEN' || msg.toLowerCase().includes('email')) {
          this.emailError.set(this.settings.t('emailAlreadyInUse'));
        } else if (code === 'USERNAME_TAKEN' || msg.toLowerCase().includes('username')) {
          this.usernameError.set(this.settings.t('usernameAlreadyInUse'));
        } else {
          this.error.set(this.settings.t('registrationFailed'));
        }
      },
    });
  }
}
