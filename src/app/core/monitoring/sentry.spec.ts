import { HttpErrorResponse } from '@angular/common/http';
import type { ErrorEvent } from '@sentry/angular';
import { environment } from '../../../environments/environment';
import type { Environment } from '../../../environments/environment.model';
import { ApiError, NETWORK_ERROR_CODE } from '../api/api-error';
import { isReportable, sentryOptions } from './sentry';

const DSN = 'https://public-key@o1.ingest.de.sentry.io/2';

const build = (overrides: Partial<Environment>): Environment => ({ ...environment, ...overrides });

describe('sentryOptions', () => {
  it('leaves Sentry off for a build without a DSN', () => {
    expect(sentryOptions(build({ sentry: { dsn: '' } }))).toBeNull();
  });

  it('reports to the DSN of the build, its stage as the environment, and no personal data', () => {
    const options = sentryOptions(build({ stage: 'staging', sentry: { dsn: DSN } }));

    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe('staging');
    expect(options?.sendDefaultPii).toBeFalse();
  });

  it('carries the trace into admin-api and nowhere else', () => {
    const options = sentryOptions(build({ sentry: { dsn: DSN } }));

    expect(options?.tracePropagationTargets).toEqual([environment.adminApiUrl]);
  });

  it('drops an event raised by a refusal and keeps one raised by a failure or a bug', () => {
    const beforeSend = sentryOptions(build({ sentry: { dsn: DSN } }))?.beforeSend;
    const event: ErrorEvent = { type: undefined };
    const send = (originalException: unknown) => beforeSend?.(event, { originalException });

    expect(send(new ApiError('NOT_FOUND', 'Not found', 404))).toBeNull();
    expect(send(new ApiError('INTERNAL_SERVER_ERROR', 'Internal error', 500))).toBe(event);
    expect(send(new TypeError('x is undefined'))).toBe(event);
  });
});

describe('isReportable', () => {
  it('reports a request that never got an answer — offline, refused or timed out', () => {
    expect(isReportable(new ApiError(NETWORK_ERROR_CODE, 'Network error', 0))).toBeTrue();
    const timedOut = new HttpErrorResponse({ status: 0, statusText: 'Request timeout' });
    expect(isReportable(timedOut)).toBeTrue();
  });

  it('reports a 5xx, whether the handler or API Gateway answered it', () => {
    expect(isReportable(new ApiError('INTERNAL_SERVER_ERROR', 'Internal error', 500))).toBeTrue();
    expect(isReportable(new ApiError('HTTP_503', 'Service Unavailable', 503))).toBeTrue();
    expect(isReportable(new HttpErrorResponse({ status: 504 }))).toBeTrue();
  });

  it('does not report a 4xx: the backend refused on purpose and the admin was told why', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(isReportable(new ApiError(`HTTP_${status}`, 'Refused', status)))
        .withContext(`ApiError ${status}`)
        .toBeFalse();
      expect(isReportable(new HttpErrorResponse({ status })))
        .withContext(`HttpErrorResponse ${status}`)
        .toBeFalse();
    }
  });

  it('reports anything else thrown, which is a bug of the panel', () => {
    expect(isReportable(new TypeError("Cannot read properties of null (reading 'x')"))).toBeTrue();
    expect(isReportable('a string thrown')).toBeTrue();
  });
});
