import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuth = await auth.checkSession();
  if (!isAuth) {
    router.navigate(['/']);
    return false;
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  if (requiredRoles && !auth.hasRole(...requiredRoles)) {
    router.navigate(['/']);
    return false;
  }

  return true;
};
