import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';

export interface NavLink {
  path: string;
  label: string;
  short: string;
  icon: 'box' | 'arrows' | 'list' | 'alert' | 'pin' | 'cog';
  managerOnly: boolean;
  exact: boolean;
}

/** Application chrome: dark sidebar on desktop, top bar + bottom tab bar + drawer on mobile. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly drawerOpen = signal(false);

  readonly allLinks = signal<NavLink[]>([
    { path: '/items', label: 'Items', short: 'Items', icon: 'box', managerOnly: false, exact: false },
    { path: '/movements/new', label: 'Record movement', short: 'Record', icon: 'arrows', managerOnly: false, exact: true },
    { path: '/movements', label: 'Movement log', short: 'Log', icon: 'list', managerOnly: true, exact: true },
    { path: '/reports/low-stock', label: 'Low stock', short: 'Low stock', icon: 'alert', managerOnly: true, exact: false },
    { path: '/locations', label: 'Locations', short: 'Zones', icon: 'pin', managerOnly: true, exact: false },
    { path: '/admin/settings', label: 'System settings', short: 'Settings', icon: 'cog', managerOnly: true, exact: false },
  ]);

  /** Nav is role-aware: manager-only destinations never render for a clerk. */
  readonly links = computed(() => {
    const manager = this.auth.isManager();
    return this.allLinks().filter((l) => manager || !l.managerOnly);
  });

  /** At most four destinations sit in the mobile tab bar; the rest live in the drawer. */
  readonly tabLinks = computed(() => this.links().slice(0, 4));

  readonly initials = computed(() => (this.auth.user()?.email ?? '?').slice(0, 2).toUpperCase());

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.drawerOpen.set(false));

    // Re-reads the profile from GET /api/auth/me once the shell mounts. It keeps
    // a role changed server-side in sync, and a token the API no longer accepts
    // comes back 401 — which the interceptor turns into a clean sign-out instead
    // of leaving manager-only nav on screen for a session that no longer exists.
    this.auth
      .refresh()
      .pipe(takeUntilDestroyed())
      .subscribe({ error: () => undefined });
  }

  toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  logout(): void {
    this.closeDrawer();
    this.auth.logout();
  }
}
