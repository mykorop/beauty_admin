import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** Mirrors of the backend's lists; they grow with every card that gains write actions. */
export const AUDIT_TARGET_TYPES = ['salon'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const AUDIT_ACTIONS = ['salon.profile.update', 'salon.hours.update'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

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
  /** What a bulk action touched; empty for every other action, absent from a backend older than this field. */
  affected?: { type: string; id: string }[];
};

/** `from` inclusive, `to` exclusive — both instants. */
export type AuditLogQuery = { from?: string; to?: string; targetType?: AuditTargetType; action?: AuditAction };

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

  /** The whole Журнал дій, newest first — the «Журнал дій» screen. */
  list(query: AuditLogQuery, cursor?: string): Observable<AuditPage> {
    return this.http.get<AuditPage>(adminApiUrl('/admin/audit'), {
      params: { ...query, ...(cursor ? { cursor } : {}) },
    });
  }
}
