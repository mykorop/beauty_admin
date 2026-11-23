import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import {
  type EnvironmentProviders,
  ErrorHandler,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Environment } from '../../../environments/environment.model';
import { ApiError } from '../api/api-error';

/** The status a failed request ended with — 0 if no answer came — or `null` for any other error. */
function statusOf(error: unknown): number | null {
  return error instanceof ApiError || error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * Whether a failure is worth an event: a request that never got an answer — offline, refused, timed
 * out, all status 0 — a 5xx, or anything else thrown, which is a bug of the panel. A 4xx is not:
 * the backend refused on purpose, the admin was told why, and the Журнал активності keeps it.
 */
export function isReportable(error: unknown): boolean {
  const status = statusOf(error);
  return status === null || status < 400 || status >= 500;
}

/**
 * What `Sentry.init` gets for a build, or `null` when the build has no DSN and Sentry stays off.
 * The environment is the stage, as on the backend and in the mobile apps, so one Sentry
 * organisation tells dev, staging and prod apart the same way everywhere. Traces go out to
 * `admin-api` only, whose CORS lets `sentry-trace` and `baggage` through — Cognito's does not.
 */
export function sentryOptions(env: Environment): Sentry.BrowserOptions | null {
  if (!env.sentry.dsn) {
    return null;
  }
  return {
    dsn: env.sentry.dsn,
    environment: env.stage,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: env.production ? 0.2 : 1,
    tracePropagationTargets: [env.adminApiUrl],
    // A refusal nobody caught still reaches the global handlers; it stays a refusal.
    beforeSend: (event, hint) => (isReportable(hint.originalException) ? event : null),
  };
}

const optionsOfThisBuild = sentryOptions(environment);

/** Starts Sentry before the app boots, so its handlers and the page-load trace start with it. */
export function initSentry(): void {
  if (optionsOfThisBuild) {
    Sentry.init(optionsOfThisBuild);
  }
}

/**
 * Angular's global error handler hands every error to Sentry, and the router names the
 * navigations of a trace. Nothing at all when the build has no DSN: Angular keeps its own handler.
 */
export function provideSentry(): EnvironmentProviders {
  return makeEnvironmentProviders(
    optionsOfThisBuild
      ? [
          { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
          provideAppInitializer(() => void inject(Sentry.TraceService)),
        ]
      : [],
  );
}

/**
 * Reports every failed request worth an event (`isReportable`): a 5xx, and a request that got no
 * answer — which may never have reached the backend, nor its Журнал активності. It sits outside the
 * `admin-api` interceptor, so it sees the `ApiError` the caller gets, after the 401 retry.
 */
export const sentryHttpInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (!isReportable(error)) {
          return;
        }
        const status = statusOf(error);
        Sentry.captureException(error, {
          tags: {
            'http.method': req.method,
            'http.status_code': status === null ? undefined : String(status),
            'error.code': error instanceof ApiError ? error.code : undefined,
          },
          contexts: { http: { method: req.method, url: req.urlWithParams } },
        });
      },
    }),
  );

/** Marks the events that follow as the signed-in admin's: his Cognito `sub`, nothing else. */
export function identifyAdmin(adminId: string): void {
  Sentry.setUser({ id: adminId });
}

/** Whoever signed out, the events that follow are nobody's. */
export function forgetAdmin(): void {
  Sentry.setUser(null);
}
