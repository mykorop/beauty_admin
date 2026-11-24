import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  stage: 'dev',
  aws: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_K7ZcnUufh',
    userPoolClientId: '1s8ffaa6cq8obnothgfbos1d1a',
  },
  // HTTP API endpoint of admin-api, stage `dev` (`serverless info --stage dev`).
  adminApiUrl: 'https://n0brp1des9.execute-api.eu-central-1.amazonaws.com',
  // The panel's own project in the organisation the backend and the apps report to; see README → Sentry.
  sentry: {
    dsn: 'https://a7ba032bfb58b136da3e9ce116290920@o4512486877626368.ingest.de.sentry.io/4512486892306512',
    orgUrl: 'https://bookme-sy.sentry.io',
  },
};
