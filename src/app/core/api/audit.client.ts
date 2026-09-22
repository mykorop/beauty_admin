import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** Mirrors of the backend's lists; they grow with every card that gains write actions. */
export const AUDIT_TARGET_TYPES = ['salon', 'master'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const AUDIT_ACTIONS = [
  'salon.profile.update',
  'salon.hours.update',
  'salon.block',
  'salon.unblock',
  'salon.master.update',
  'salon.master.remove',
  'salon.master.hours.update',
  'salon.master.schedule-pattern.update',
  'salon.master.time-off.create',
  'salon.master.time-off.remove',
  'salon.service.create',
  'salon.service.update',
  'salon.service.deactivate',
  'salon.master.service.create',
  'salon.master.service.update',
  'salon.master.service.remove',
  'master.profile.update',
  'master.block',
  'master.unblock',
  'master.service.create',
  'master.service.update',
  'master.service.deactivate',
  'master.hours.update',
  'master.schedule-pattern.update',
  'master.time-off.create',
  'master.time-off.remove',
  // The Записи actions. Unlike every value above, their prefix is not the target type: one Запис
  // belongs to a Салон or to a Незалежний майстер and the decision reads the same either way, so
  // the filter offers one value per decision and `targetType` carries whose Запис it was.
  'appointment.cancel',
  'appointment.status.update',
  'appointment.reschedule',
  'appointment.bulk-cancel',
] as const;
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
