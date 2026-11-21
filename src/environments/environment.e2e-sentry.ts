import { environment as e2e } from './environment.e2e';
import type { Environment } from './environment.model';

/**
 * The e2e build with Sentry on, for `e2e/sentry.spec.ts` alone. Its ingest host is as made up as
 * the rest: the spec answers it itself, and `.invalid` keeps an event it misses on this machine.
 */
export const environment: Environment = {
  ...e2e,
  sentry: { dsn: 'https://e2epublickey@sentry.e2e.invalid/1' },
};
