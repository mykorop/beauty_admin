import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** How a request ended: 2xx–3xx, 4xx, 5xx. */
export type ActivityOutcome = 'ok' | 'rejected' | 'failed';

/** The error envelope the request was answered with — never the rest of the response. */
export type ActivityError = { code: string; message: string; details?: unknown };

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
  actor: { id: string; role: string } | null;
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
