import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SessionExpiry } from '../auth/session-expiry';
import { adminApiInterceptor, SILENT_ERROR_CODES } from './admin-api.interceptor';
import { ApiError } from './api-error';

const ME_URL = `${environment.adminApiUrl}/admin/me`;

/** Lets the interceptor's token promise settle so the request reaches the testing backend. */
const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('adminApiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let sessionExpiry: jasmine.SpyObj<SessionExpiry>;
  let messages: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getIdToken']);
    auth.getIdToken.and.resolveTo('token-1');
    sessionExpiry = jasmine.createSpyObj<SessionExpiry>('SessionExpiry', ['expire']);
    sessionExpiry.expire.and.resolveTo();
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['add']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([adminApiInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: SessionExpiry, useValue: sessionExpiry },
        { provide: MessageService, useValue: messages },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sends the ID token and hands the caller the payload inside the envelope', async () => {
    let body: unknown;
    http.get(ME_URL).subscribe((value) => (body = value));
    await flushPromises();

    const request = backend.expectOne(ME_URL);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({ success: true, data: { adminId: 'a1', email: 'admin@bookme.md' } });

    expect(body).toEqual({ adminId: 'a1', email: 'admin@bookme.md' });
  });

  it('leaves a request to any other origin untouched', () => {
    http.get('https://elsewhere.example/file.json').subscribe();

    const request = backend.expectOne('https://elsewhere.example/file.json');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(auth.getIdToken).not.toHaveBeenCalled();
    request.flush({});
  });

  it('turns a refusal into an ApiError and shows its code translated', async () => {
    let error: unknown;
    http.get(ME_URL).subscribe({ error: (value: unknown) => (error = value) });
    await flushPromises();

    backend
      .expectOne(ME_URL)
      .flush(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('FORBIDDEN');
    expect((error as ApiError).status).toBe(403);
    expect(messages.add).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ severity: 'error', detail: 'Недостатньо прав для цієї дії.' }),
    );
  });

  it('shows a code it has no wording for as it is', async () => {
    http.get(ME_URL).subscribe({ error: () => undefined });
    await flushPromises();

    backend
      .expectOne(ME_URL)
      .flush(
        { success: false, error: { code: 'SALON_HAS_FUTURE_APPOINTMENTS', message: 'nope' } },
        { status: 409, statusText: 'Conflict' },
      );

    expect(messages.add).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ detail: 'SALON_HAS_FUTURE_APPOINTMENTS' }),
    );
  });

  it('stays quiet about a code the caller said it words itself', async () => {
    let error: unknown;
    const context = new HttpContext().set(SILENT_ERROR_CODES, ['FORBIDDEN']);
    http.get(ME_URL, { context }).subscribe({ error: (value: unknown) => (error = value) });
    await flushPromises();

    backend
      .expectOne(ME_URL)
      .flush({ success: false, error: { code: 'FORBIDDEN', message: 'no' } }, { status: 403, statusText: '' });

    expect((error as ApiError).code).toBe('FORBIDDEN');
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('reports a transport failure as NETWORK_ERROR', async () => {
    let error: unknown;
    http.get(ME_URL).subscribe({ error: (value: unknown) => (error = value) });
    await flushPromises();

    backend.expectOne(ME_URL).error(new ProgressEvent('error'));

    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect(messages.add).toHaveBeenCalledTimes(1);
  });

  it('expires the session instead of sending a request without a token', async () => {
    auth.getIdToken.and.resolveTo(null);
    let error: unknown;
    http.get(ME_URL).subscribe({ error: (value: unknown) => (error = value) });
    await flushPromises();

    backend.expectNone(ME_URL);
    expect(sessionExpiry.expire).toHaveBeenCalledTimes(1);
    expect((error as ApiError).code).toBe('UNAUTHORIZED');
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('answers a 401 with one forced refresh and a retry', async () => {
    auth.getIdToken.and.callFake((options) => Promise.resolve(options?.forceRefresh ? 'token-2' : 'token-1'));
    let body: unknown;
    http.get(ME_URL).subscribe((value) => (body = value));
    await flushPromises();

    backend
      .expectOne(ME_URL)
      .flush({ success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }, { status: 401, statusText: '' });
    await flushPromises();

    const retry = backend.expectOne(ME_URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-2');
    retry.flush({ success: true, data: { ok: true } });

    expect(body).toEqual({ ok: true });
    expect(sessionExpiry.expire).not.toHaveBeenCalled();
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('expires the session when the retried request is refused with 401 again', async () => {
    const unauthorized = { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } };
    let error: unknown;
    http.get(ME_URL).subscribe({ error: (value: unknown) => (error = value) });
    await flushPromises();

    backend.expectOne(ME_URL).flush(unauthorized, { status: 401, statusText: '' });
    await flushPromises();
    backend.expectOne(ME_URL).flush(unauthorized, { status: 401, statusText: '' });
    await flushPromises();

    expect(sessionExpiry.expire).toHaveBeenCalledTimes(1);
    expect((error as ApiError).code).toBe('UNAUTHORIZED');
    expect(messages.add).not.toHaveBeenCalled();
  });
});
