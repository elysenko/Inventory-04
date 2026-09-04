import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly error = signal<string | null>(null);

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
    const result = this.auth.signup(this.email(), this.password());
    if (!result.ok) this.error.set(result.message);
  }

  skipSignup(): void {
    this.auth.demoLogin('clerk');
  }
}
