import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page">
      <div class="card">
        <h1>{{ 'signIn' | t }}</h1>
        <p class="sub">{{ 'authWelcomeBack' | t }}</p>
        <form (ngSubmit)="submit()">
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
                autocomplete="current-password"
                (blur)="checkPassword()"
                [class.error]="passwordError()"
              />
              <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())">
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
            @if (passwordError(); as err) {
              <span class="field-err">{{ err }}</span>
            }
          </label>
          @if (error()) {
            <p class="err">{{ error() }}</p>
          }
          <button type="submit" class="primary" [disabled]="loading()">
            @if (loading()) {
              {{ 'loading' | t }}
            } @else {
              {{ 'authContinue' | t }}
            }
          </button>
        </form>
        <p class="foot">
          {{ 'noAccount' | t }} <a routerLink="/register">{{ 'register' | t }}</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      width: 100%;
      max-width: 380px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.35rem;
    }
    .sub {
      color: var(--accent-dim);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--accent-dim);
    }
    input {
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--accent);
    }
    input:focus {
      outline: none;
      border-color: var(--accent-dim);
    }
    input.error {
      border-color: var(--danger);
    }
    .pwd-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .pwd-wrap input {
      flex: 1;
      padding-right: 44px;
    }
    .eye-btn {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: var(--accent-dim);
      display: flex;
      transition: color 0.2s;
    }
    .eye-btn:hover {
      color: var(--accent);
    }
    .eye-btn svg {
      width: 20px;
      height: 20px;
    }
    .field-err {
      color: var(--danger);
      font-size: 0.75rem;
    }
    .primary {
      margin-top: 0.5rem;
      padding: 0.7rem;
      border-radius: 999px;
      border: none;
      background: var(--accent);
      color: var(--bg);
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .primary:hover:not(:disabled) {
      opacity: 0.92;
    }
    .primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .err {
      color: var(--danger);
      font-size: 0.85rem;
    }
    .foot {
      margin-top: 1.25rem;
      font-size: 0.9rem;
      color: var(--accent-dim);
    }
    .foot a {
      color: var(--accent);
    }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);

  email = '';
  password = '';

  loading = signal(false);
  error = signal('');
  emailError = signal('');
  passwordError = signal('');
  showPassword = signal(false);

  constructor() {
    if (this.auth.isLoggedIn()) {
      void this.router.navigate(['/']);
    }
  }

  checkEmail(): void {
    const e = this.email.trim();
    if (!e) {
      this.emailError.set(this.settings.t('emailRequired'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(e)) {
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
    this.passwordError.set('');
  }

  submit(): void {
    this.checkEmail();
    this.checkPassword();

    if (this.emailError() || this.passwordError()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => void this.router.navigate(['/']),
      error: () => {
        this.loading.set(false);
        this.error.set(this.settings.t('invalidEmailOrPassword'));
      },
    });
  }
}
