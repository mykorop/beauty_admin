/**
 * `dev` and `staging` share one Cognito pool and one DynamoDB table on the backend, so either of
 * them shows data the other one wrote. The header indicator says so instead of pretending the two
 * are isolated.
 */
export type EnvironmentStage = 'dev' | 'staging' | 'prod';

export type Environment = {
  production: boolean;
  stage: EnvironmentStage;
  aws: {
    region: string;
    userPoolId: string;
    userPoolClientId: string;
  };
  /** Base URL of `admin-api`, without the `/admin` prefix and without a trailing slash. */
  adminApiUrl: string;
  sentry: {
    /**
     * DSN of the panel's own Sentry project. Public by design — it only lets a browser send
     * events — so it lives here, not in a secret. Empty leaves Sentry off: no SDK, no events.
     */
    dsn: string;
    /**
     * Address of the Sentry organisation the panel, the backend and the apps report to —
     * `https://<org>.sentry.io` — which an activity entry's «Траса в Sentry» and «Подія в Sentry»
     * and a card's «Помилки в Sentry» lead into. Independent of the DSN: empty, no such links.
     */
    orgUrl: string;
  };
};
