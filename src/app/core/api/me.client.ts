import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';

export type AdminIdentity = {
  adminId: string;
  email: string;
};

@Injectable({ providedIn: 'root' })
export class MeClient {
  private readonly http = inject(HttpClient);

  /** A 403 is silenced: the guard answers it with the refusal on the login screen. */
  get(): Observable<AdminIdentity> {
    return this.http.get<AdminIdentity>(adminApiUrl('/admin/me'), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['FORBIDDEN', 'HTTP_403']),
    });
  }
}
