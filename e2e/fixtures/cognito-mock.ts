import type { BrowserContext, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.e2e';

const COGNITO_ORIGIN = `https://cognito-idp.${environment.aws.region}.amazonaws.com`;

/** The only TOTP code the mocked pool accepts. */
export const VALID_TOTP = '123456';

export type CognitoAccount = {
  email: string;
  /** Value of the `custom:role` claim in the issued ID token. */
  role: string;
  /** `false` answers the password with tokens straight away, as a pool user without TOTP would get. */
  totp?: boolean;
};

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Amplify reads claims out of a token but never verifies its signature — that is the backend's job. */
function jwt(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  return `${base64Url({ alg: 'RS256', kid: 'e2e' })}.${base64Url({ iat: now, exp: now + 3600, ...claims })}.signature`;
}

function authenticationResult(account: CognitoAccount): object {
  const sub = 'e2e-user-sub';
  return {
    AuthenticationResult: {
      AccessToken: jwt({ sub, username: sub, token_use: 'access', scope: 'aws.cognito.signin.user.admin' }),
      IdToken: jwt({
        sub,
        'cognito:username': sub,
        token_use: 'id',
        email: account.email,
        'custom:role': account.role,
      }),
      RefreshToken: 'e2e-refresh-token',
      ExpiresIn: 3600,
      TokenType: 'Bearer',
    },
    ChallengeParameters: {},
  };
}

async function fulfillJson(route: Route, status: number, body: object): Promise<void> {
  await route.fulfill({ status, contentType: 'application/x-amz-json-1.1', body: JSON.stringify(body) });
}

/**
 * Stands in for the Cognito user pool, so that the app's real Amplify code runs the whole sign-in:
 * SRP password step → `SOFTWARE_TOKEN_MFA` challenge → tokens. The SRP numbers are arbitrary — the
 * client proves the password to the server, never the other way round, and this server accepts any.
 */
export async function installCognitoMock(context: BrowserContext, account: CognitoAccount): Promise<void> {
  await context.route(`${COGNITO_ORIGIN}/**`, async (route: Route): Promise<void> => {
    const request = route.request();
    const target = (request.headers()['x-amz-target'] ?? '').split('.').pop();
    const body = (request.postDataJSON() ?? {}) as { ChallengeName?: string; ChallengeResponses?: Record<string, string> };

    if (target === 'InitiateAuth') {
      await fulfillJson(route, 200, {
        ChallengeName: 'PASSWORD_VERIFIER',
        ChallengeParameters: {
          SALT: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
          SECRET_BLOCK: Buffer.from('e2e-secret-block').toString('base64'),
          SRP_B: 'b7'.repeat(384),
          USERNAME: 'e2e-user-sub',
          USER_ID_FOR_SRP: 'e2e-user-sub',
        },
      });
      return;
    }

    if (target === 'RespondToAuthChallenge' && body.ChallengeName === 'PASSWORD_VERIFIER') {
      await fulfillJson(
        route,
        200,
        account.totp === false
          ? authenticationResult(account)
          : { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'e2e-session', ChallengeParameters: {} },
      );
      return;
    }

    if (target === 'RespondToAuthChallenge' && body.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      if (body.ChallengeResponses?.['SOFTWARE_TOKEN_MFA_CODE'] === VALID_TOTP) {
        await fulfillJson(route, 200, authenticationResult(account));
      } else {
        await fulfillJson(route, 400, {
          __type: 'CodeMismatchException',
          message: 'Invalid code received for user',
        });
      }
      return;
    }

    // RevokeToken / GlobalSignOut on sign-out: nothing to answer with.
    await fulfillJson(route, 200, {});
  });
}
