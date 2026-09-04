import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api.service';
import { AuthService, DEMO_ACCOUNTS } from '../../core/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  /** `POST /api/auth/signup` always creates a clerk — the role is assigned server-side
   *  and any `role` in the body is stripped before it reaches the service. */
  onSubmit(): void {
    this.error.set(null);
    if (!this.name().trim()) {
      this.error.set('Enter the name your colleagues will see on the audit log.');
      return;
    }
    if (this.password() !== this.confirm()) {
      this.error.set('The two passwords do not match.');
      return;
    }
    if (this.password().length < 8) {
      this.error.set('Choose a password of at least 8 characters.');
      return;
    }
    this.submit(this.email(), this.password(), this.name());
  }

  /** Signs in with the seeded clerk account instead of creating a new one. */
  skipSignup(): void {
    const clerk = DEMO_ACCOUNTS.find((a) => a.role === 'clerk') ?? DEMO_ACCOUNTS[0];
    this.error.set(null);
    this.auth
      .login(clerk.email, clerk.password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (err: unknown) => this.error.set(apiErrorMessage(err)) });
  }

  private submit(email: string, password: string, name?: string): void {
    if (this.submitting()) return;
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
      this.error.set('That email address does not look valid.');
      return;
    }

    this.submitting.set(true);
    this.auth
      .signup(trimmed, password, name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.submitting.set(false),
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }
}
