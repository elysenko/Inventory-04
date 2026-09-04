import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api.service';
import { AuthService, DEMO_ACCOUNTS } from '../../core/auth.service';
import type { Role } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly demoAccounts = DEMO_ACCOUNTS;

  readonly email = signal('manager@demo');
  readonly password = signal('Demo1234!');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  /** Exchanges the credentials for a JWT at `POST /api/auth/login`. The server
   *  answers "Invalid email or password" identically for an unknown account and
   *  a wrong password, so the form cannot be used to enumerate users. */
  onSubmit(): void {
    this.submit(this.email(), this.password());
  }

  useAccount(email: string, password: string): void {
    this.email.set(email);
    this.password.set(password);
    this.error.set(null);
  }

  /** One-click sign-in with a seeded account — a real login round-trip. */
  skipLogin(role: Role = 'manager'): void {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
    this.useAccount(account.email, account.password);
    this.submit(account.email, account.password);
  }

  private submit(email: string, password: string): void {
    if (this.submitting()) return;
    this.error.set(null);

    const trimmed = email.trim();
    if (!trimmed || !password) {
      this.error.set('Enter both your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
      this.error.set('That email address does not look valid.');
      return;
    }

    this.submitting.set(true);
    this.auth
      .login(trimmed, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // AuthService stores the session and routes on to the requested page.
        next: () => this.submitting.set(false),
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }
}
