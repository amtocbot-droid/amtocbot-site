import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Role = 'superadmin' | 'admin' | 'tester' | 'approver' | 'reviewer';
export type Permission =
  | 'dashboard.view'
  | 'issues.create' | 'issues.update_status' | 'issues.assign' | 'issues.close' | 'issues.comment'
  | 'content.qa.update' | 'content.qa.approve' | 'content.qa.reject'
  | 'qa.acknowledge'
  | 'qa.signoff'
  | 'users.manage'
  | 'users.manage_admins'
  | 'content.delete'
  | 'audit.view'
  | 'sessions.view';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [],
  admin:    [],
  tester:   ['dashboard.view', 'issues.create', 'issues.update_status', 'issues.comment', 'content.qa.update'],
  approver: ['dashboard.view', 'issues.close', 'issues.comment', 'content.qa.approve', 'content.qa.reject', 'qa.acknowledge', 'qa.signoff'],
  reviewer: ['dashboard.view', 'issues.comment'],
};

interface SessionResponse {
  authenticated: boolean;
  username?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  user = signal<{ username: string; role: string } | null>(null);
  authenticated = signal(false);
  loading = signal(true);

  role = computed(() => this.user()?.role as Role | null);
  username = computed(() => this.user()?.username ?? null);

  private checked = false;

  checkSession(): Promise<boolean> {
    if (this.checked) return Promise.resolve(this.authenticated());

    this.loading.set(true);
    return new Promise(resolve => {
      this.http.get<SessionResponse>('/api/auth/session').subscribe({
        next: (res) => {
          if (res.authenticated && res.username && res.role) {
            this.user.set({ username: res.username, role: res.role });
            this.authenticated.set(true);
          } else {
            this.user.set(null);
            this.authenticated.set(false);
          }
          this.checked = true;
          this.loading.set(false);
          resolve(this.authenticated());
        },
        error: () => {
          this.user.set(null);
          this.authenticated.set(false);
          this.checked = true;
          this.loading.set(false);
          resolve(false);
        },
      });
    });
  }

  hasPermission(perm: Permission): boolean {
    const r = this.role();
    if (!r) return false;
    if (r === 'superadmin') return true;
    if (r === 'admin') {
      const superadminOnly: Permission[] = ['users.manage_admins', 'audit.view', 'sessions.view'];
      if (superadminOnly.includes(perm)) return false;
      return true;
    }
    const perms = ROLE_PERMISSIONS[r];
    return perms ? perms.includes(perm) : false;
  }

  /** Check if the user has any of the given roles */
  hasRole(...roles: string[]): boolean {
    const r = this.role();
    return r ? roles.includes(r) : false;
  }
}
