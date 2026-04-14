import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const isAuth = await auth.checkSession();
  const path = '/' + (route.url.map(s => s.path).join('/') || '');

  if (!isAuth) {
    snackBar.open('Please log in to access this page.', 'Dismiss', { duration: 4000 });
    logAccessDenied(path, 'unauthenticated', undefined);
    router.navigate(['/']);
    return false;
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  if (requiredRoles && !auth.hasRole(...requiredRoles)) {
    const pageName = path.replace('/', '');
    snackBar.open(`You don't have permission to access ${pageName}.`, 'Dismiss', { duration: 4000 });
    logAccessDenied(path, 'unauthorized', auth.role() ?? undefined);
    const hasDashboard = auth.hasRole('superadmin', 'admin', 'tester', 'approver', 'reviewer');
    router.navigate([hasDashboard ? '/dashboard' : '/']);
    return false;
  }

  return true;
};

function logAccessDenied(path: string, reason: 'unauthenticated' | 'unauthorized', role?: string): void {
  fetch('/api/auth/access-denied', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, reason, role }),
    credentials: 'include',
  }).catch(() => { /* ignore */ });
}
