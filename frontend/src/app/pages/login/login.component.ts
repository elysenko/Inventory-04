import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

  readonly demoAccounts = DEMO_ACCOUNTS;

  readonly email = signal('manager@demo');
  readonly password = signal('Demo1234!');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  onSubmit(): void {
    this.error.set(null);
    this.submitting.set(true);
    const result = this.auth.login(this.email(), this.password());
    this.submitting.set(false);
    if (!result.ok) this.error.set(result.message);
  }

  useAccount(email: string, password: string): void {
    this.email.set(email);
    this.password.set(password);
    this.error.set(null);
  }

  skipLogin(role: Role = 'manager'): void {
    this.auth.demoLogin(role);
  }
}
