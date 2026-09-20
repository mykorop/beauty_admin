import type { Environment } from './environment.model';

/**
 * What the Playwright suite is served with. Every origin below is intercepted by the suite, and
 * `.invalid` guarantees that a request the suite failed to intercept cannot reach a real backend.
 */
export const environment: Environment = {
  production: false,
  stage: 'dev',
  aws: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_e2ePool00',
    userPoolClientId: 'e2e-client-id',
  },
  adminApiUrl: 'https://admin-api.e2e.invalid',
};
