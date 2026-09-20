import {
  HttpContextToken,
  HttpErrorResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, from, map, type Observable, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../i18n/i18n.service';
import { AuthService } from '../auth/auth.service';
import { SessionExpiry } from '../auth/session-expiry';
import { ApiError, NETWORK_ERROR_CODE } from './api-error';

/**
 * Error codes the caller words itself, so the interceptor must not also raise a toast for them.
 * The `ApiError` is thrown either way.
 */
export const SILENT_ERROR_CODES = new HttpContextToken<readonly string[]>(() => []);

const UNAUTHORIZED = 401;

type ErrorEnvelope = { success: false; error: { code: string; message: string; details?: unknown } };

function isSuccessEnvelope(body: unknown): body is { success: true; data: unknown } {
  return typeof body === 'object' && body !== null && (body as { success?: unknown }).success === true;
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  const error = (body as { error?: { code?: unknown } } | null)?.error;
  return typeof error === 'object' && error !== null && typeof error.code === 'string';
}

function toApiError(error: HttpErrorResponse): ApiError {
  if (error.status === 0) {
    return new ApiError(NETWORK_ERROR_CODE, 'Network error', 0);
  }
  if (isErrorEnvelope(error.error)) {
    const { code, message, details } = error.error.error;
    return new ApiError(code, message, error.status, details);
  }
  // No envelope: the refusal came from API Gateway itself, not from a handler.
  return new ApiError(`HTTP_${error.status}`, error.message, error.status);
}

const sessionExpiredError = (): ApiError => new ApiError('UNAUTHORIZED', 'Session expired', UNAUTHORIZED);

/**
 * Everything a call to `/admin/*` has in common: the ID token goes out, the `{ success, data }`
 * envelope comes off, and a refusal becomes an `ApiError` shown as a toast worded by its
 * `error.code`. A 401 gets one forced token refresh and one retry; if that fails too the session
 * is over, and the login screen — not a toast — is the feedback.
 */
export const adminApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${environment.adminApiUrl}/`)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const sessionExpiry = inject(SessionExpiry);
  const i18n = inject(I18nService);
  const messages = inject(MessageService);

  const expireSession = (): Observable<never> =>
    from(sessionExpiry.expire()).pipe(switchMap(() => throwError(sessionExpiredError)));

  const send = (options: { forceRefresh: boolean }): Observable<HttpEvent<unknown>> =>
    from(auth.getIdToken(options)).pipe(
      switchMap((token) =>
        token ? sendWithToken(req, next, token) : expireSession(),
      ),
    );

  return send({ forceRefresh: false }).pipe(
    catchError((error: unknown) =>
      isUnauthorizedResponse(error) ? send({ forceRefresh: true }) : throwError(() => error),
    ),
    catchError((error: unknown) => (isUnauthorizedResponse(error) ? expireSession() : throwError(() => error))),
    catchError((error: unknown) => {
      // Anything that is not an HTTP failure is a bug in the pipeline, not a refusal to word.
      if (!(error instanceof HttpErrorResponse) && !(error instanceof ApiError)) {
        return throwError(() => error);
      }
      const apiError = error instanceof ApiError ? error : toApiError(error);
      const silent = apiError.status === UNAUTHORIZED || req.context.get(SILENT_ERROR_CODES).includes(apiError.code);
      if (!silent) {
        messages.add({
          severity: 'error',
          summary: i18n.t('error.title'),
          detail: i18n.errorMessage(apiError.code),
          life: 8000,
        });
      }
      return throwError(() => apiError);
    }),
  );
};

function isUnauthorizedResponse(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === UNAUTHORIZED;
}

function sendWithToken(req: HttpRequest<unknown>, next: HttpHandlerFn, token: string): Observable<HttpEvent<unknown>> {
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    map((event) =>
      event instanceof HttpResponse && isSuccessEnvelope(event.body) ? event.clone({ body: event.body.data }) : event,
    ),
  );
}
