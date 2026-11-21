import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** How a request ended: 2xx–3xx, 4xx, 5xx. */
export type ActivityOutcome = 'ok' | 'rejected' | 'failed';

/** The error envelope the request was answered with — never the rest of the response. */
export type ActivityError = { code: string; message: string; details?: unknown };

/**
 * Who acted, named as his profile reads now — a Видалений one too. `name` is `null` for an account
 * with no profile (the Адміністратор платформи) or a profile that names nobody.
 */
export type ActivityActor = { id: string; role: string; name: string | null };

/** A Місце — a Салон, or a Незалежний майстер — named as its profile reads now, `null` when it names nothing. */
export type ActivityPlace = { type: 'salon' | 'master'; id: string; name: string | null };

/** One entry of the Журнал активності: one request, as it was answered. */
export type ActivityEntry = {
  activityId: string;
  createdAt: string;
  /** dev and staging share a table, so each entry says which stage wrote it. */
  stage: string;
  /** `client-api`, `salon-api`, `master-api` or `admin-api`. */
  service: string;
  /** API Gateway's `routeKey`, e.g. `PATCH /client/appointments/{appointmentId}/cancel`. */
  route: string;
  pathParams: Record<string, string>;
  /**
   * `null` — nobody signed in, or a token that did not verify. `role` is the backend's `UserRole`
   * (`client`, `salon`, `salon_admin`, `master`, `admin`), worded by `activityLog.role.<role>`.
   */
  actor: ActivityActor | null;
  /** A token that did not verify (a `401`): the `sub` it claimed — unchecked, so never the actor. */
  claimedActorId: string | null;
  /** The Салон the request worked in, if any. */
  salonId: string | null;
  /** The Майстер it concerned, if any. */
  masterId: string | null;
  /** Where it happened: its Салон, or — with none — its Майстер; `null` without a Місце. */
  place: ActivityPlace | null;
  outcome: ActivityOutcome;
  status: number;
  error: ActivityError | null;
  durationMs: number;
  /** `requestContext.requestId` — what the request's CloudWatch lines carry. */
  requestId: string;
  traceId: string | null;
  sentryEventId: string | null;
};

/** `from` inclusive, `to` exclusive — both instants; neither, and the backend serves today on the platform's clock. */
export type ActivityLogQuery = { from?: string; to?: string };

export type ActivityPage = { items: ActivityEntry[]; nextCursor: string | null };

@Injectable({ providedIn: 'root' })
export class ActivityClient {
  private readonly http = inject(HttpClient);

  /** The whole platform's Журнал активності for a period, newest first — the «Журнал активності» screen. */
  list(query: ActivityLogQuery, cursor?: string): Observable<ActivityPage> {
    return this.http.get<ActivityPage>(adminApiUrl('/admin/activity'), {
      params: { ...query, ...(cursor ? { cursor } : {}) },
    });
  }
}
