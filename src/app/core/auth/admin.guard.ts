import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { ApiError } from '../api/api-error';
import { AdminSession } from './admin-session';
import { AuthService } from './auth.service';
import { LOGIN_PATH } from './session-expiry';

/**
 * Lets only a confirmed administrator into the shell. Two checks, because they fail differently:
 * the token's role claim (no session, or somebody else's → login), then `GET /admin/me`, where the
 * backend has the last word — its 403 signs the user out with the same refusal.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const session = inject(AdminSession);
  const router = inject(Router);

  if (!(await auth.hasAdminSession())) {
    return router.createUrlTree([LOGIN_PATH], { queryParams: { returnUrl: state.url } });
  }

  try {
    await session.load();
    return true;
  } catch (error) {
    // By status, not by code: a 403 from API Gateway itself carries no envelope and no `FORBIDDEN`.
    if (error instanceof ApiError && error.status === 403) {
      await auth.signOut();
      return router.createUrlTree([LOGIN_PATH], { queryParams: { reason: 'notAdmin' } });
    }
    if (error instanceof ApiError && error.status === 401) {
      // The interceptor has already signed out and is navigating to the login screen.
      return false;
    }
    // A backend that is down is not a reason to hide the shell: the interceptor has shown the
    // error, and every section will report its own failure the same way.
    return true;
  }
};
