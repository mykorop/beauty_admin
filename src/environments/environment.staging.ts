import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  stage: 'staging',
  aws: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_K7ZcnUufh',
    userPoolClientId: '1s8ffaa6cq8obnothgfbos1d1a',
  },
  // HTTP API endpoint of admin-api, stage `staging` (`serverless info --stage staging`).
  adminApiUrl: 'https://bdw2dzytff.execute-api.eu-central-1.amazonaws.com',
};
