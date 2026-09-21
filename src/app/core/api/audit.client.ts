import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

export type AuditTargetType = 'salon';

/** One changed field of a Журнал дій entry; an absent value is `null` on either side. */
export type AuditFieldChange = { field: string; before: unknown; after: unknown };

export type AuditEntry = {
  auditId: string;
  adminId: string;
  adminEmail: string | null;
  targetType: AuditTargetType;
  targetId: string;
  salonId: string | null;
  /** A stable string such as `salon.profile.update`; worded by `audit.action.<action>`. */
  action: string;
  createdAt: string;
  /** Full values, PII included. */
  changes: AuditFieldChange[];
  reason: string | null;
};

export type AuditPage = { items: AuditEntry[]; nextCursor: string | null };

@Injectable({ providedIn: 'root' })
export class AuditClient {
  private readonly http = inject(HttpClient);

  /** The Журнал дій of one target, newest first — the «Історія» tab of its card. */
  forTarget(type: AuditTargetType, id: string, cursor?: string): Observable<AuditPage> {
    return this.http.get<AuditPage>(adminApiUrl('/admin/audit'), {
      params: { target: `${type}:${id}`, ...(cursor ? { cursor } : {}) },
    });
  }
}
