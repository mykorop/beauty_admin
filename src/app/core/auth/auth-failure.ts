export type AuthFailureReason =
  | 'credentials'
  | 'totpInvalid'
  | 'totpExpired'
  | 'notAdmin'
  | 'mfaRequired'
  | 'unsupportedStep'
  | 'tooManyAttempts'
  | 'generic';

/** Why a sign-in attempt did not produce an administrator session, in terms the login screen can word. */
export class AuthFailure extends Error {
  constructor(
    readonly reason: AuthFailureReason,
    /** The Cognito step name, for `unsupportedStep`. */
    readonly step?: string,
  ) {
    super(reason);
    this.name = 'AuthFailure';
  }
}

/** Maps a Cognito error thrown by Amplify onto a reason. `stage` disambiguates `NotAuthorizedException`. */
export function toAuthFailure(error: unknown, stage: 'password' | 'totp'): AuthFailure {
  if (error instanceof AuthFailure) {
    return error;
  }

  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAuthorizedException':
      // On the password step this is a wrong password; on the TOTP step the password was already
      // accepted, so it can only mean the three-minute challenge session ran out.
      return new AuthFailure(stage === 'password' ? 'credentials' : 'totpExpired');
    case 'UserNotFoundException':
      return new AuthFailure('credentials');
    case 'CodeMismatchException':
    case 'EnableSoftwareTokenMFAException':
      return new AuthFailure('totpInvalid');
    case 'ExpiredCodeException':
      return new AuthFailure('totpExpired');
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return new AuthFailure('tooManyAttempts');
    default:
      return new AuthFailure('generic');
  }
}
