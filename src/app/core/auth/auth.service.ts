import { Injectable } from '@angular/core';
import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import { environment } from '../../../environments/environment';
import { AuthFailure, toAuthFailure } from './auth-failure';

export const ADMIN_ROLE = 'admin';
const ROLE_CLAIM = 'custom:role';
const TOTP_STEP = 'CONFIRM_SIGN_IN_WITH_TOTP_CODE';

export function configureAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: environment.aws.userPoolId,
        userPoolClientId: environment.aws.userPoolClientId,
      },
    },
  });
}

/**
 * The only place that talks to Cognito. Sign-in is two calls — password, then TOTP — and yields a
 * session only for an account whose ID token carries `custom:role = admin`; anybody else is signed
 * out again before the caller hears about it. The backend checks the role on its own on every
 * request, so this is about not showing the shell to the wrong person, not about protecting data.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * Submits email and password. Resolves when Cognito asks for the TOTP code — the only outcome
   * that may continue. The pool keeps MFA `OPTIONAL` (it is shared with clients and salons), so an
   * account that gets a session from the password alone is an admin account set up wrongly, and it
   * is refused rather than let in on one factor.
   */
  async signInWithPassword(email: string, password: string): Promise<void> {
    try {
      // Amplify refuses to start a sign-in over a live session, e.g. one left by a closed tab.
      await signOut().catch(() => undefined);

      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (nextStep.signInStep === TOTP_STEP) {
        return;
      }

      if (isSignedIn) {
        // Clients, salons and masters have no TOTP, so this is where they end up: tell them they
        // have no access, and keep the TOTP wording for an admin account that was set up wrongly.
        const isAdmin = await this.hasAdminSession();
        await this.signOut();
        throw new AuthFailure(isAdmin ? 'mfaRequired' : 'notAdmin');
      }
      throw new AuthFailure('unsupportedStep', nextStep.signInStep);
    } catch (error) {
      throw toAuthFailure(error, 'password');
    }
  }

  /** Answers the TOTP challenge. A wrong code keeps the challenge open, so it can simply be retried. */
  async confirmTotp(code: string): Promise<void> {
    try {
      const { isSignedIn, nextStep } = await confirmSignIn({ challengeResponse: code });
      if (!isSignedIn) {
        throw new AuthFailure('unsupportedStep', nextStep.signInStep);
      }

      if (!(await this.hasAdminSession())) {
        await this.signOut();
        throw new AuthFailure('notAdmin');
      }
    } catch (error) {
      throw toAuthFailure(error, 'totp');
    }
  }

  async signOut(): Promise<void> {
    await signOut().catch(() => undefined);
  }

  /**
   * The ID token `admin-api` expects, or `null` when there is no session. Amplify refreshes an
   * expired token on this call by itself, which is the whole of "the session renews silently";
   * `null` therefore means the refresh token is gone too.
   */
  async getIdToken(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh: options.forceRefresh ?? false });
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  async hasAdminSession(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.payload[ROLE_CLAIM] === ADMIN_ROLE;
    } catch {
      return false;
    }
  }
}
