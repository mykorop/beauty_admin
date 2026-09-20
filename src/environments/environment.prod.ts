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
};
