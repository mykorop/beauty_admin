import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  stage: 'prod',
  aws: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_sgAQVTwci',
    userPoolClientId: '3ji1cneqm4eudg75m330vp9fvd',
  },
  // HTTP API endpoint of admin-api, stage `prod` (`serverless info --stage prod`).
  adminApiUrl: 'https://18mfwx1bcb.execute-api.eu-central-1.amazonaws.com',
  // The panel's own project in the organisation the backend and the apps report to; see README → Sentry.
  sentry: {
    dsn: 'https://a7ba032bfb58b136da3e9ce116290920@o4512486877626368.ingest.de.sentry.io/4512486892306512',
    orgUrl: 'https://bookme-sy.sentry.io',
  },
};
