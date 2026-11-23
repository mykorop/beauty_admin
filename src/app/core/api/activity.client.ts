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

/**
 * The app a request came from, as its `X-BookMe-Client` header named it: `app` — `client` (the
 * client app), `salon` (the business app) or `admin` (this panel); `platform` — `ios`, `android`
 * or `web`; `version` — the build's own.
 */
export type ActivityApp = { app: string; version: string; platform: string };

/** The account a push, an SMS or an email went to, and the role it was addressed to, if known. */
export type ActivityRecipient = { id: string; role: string | null };

/**
 * One try to deliver something a request caused: a push to one device, an SMS, an email. `recipient`
 * is the account it went to — `role` `null` where the sender did not know it — and `null` for none
 * (an SMS to a walk-in's number, an invitation to an address no account holds); never a device,
 * number or address. `result` — `sent`, `failed`, or `invalid-token` (FCM no longer knows the
 * device); `code` — why not, in the words of whoever said no (`UNREGISTERED`, `rate-limited`,
 * `MessageRejected`).
 */
export type ActivityDeliveryEffect = {
  kind: 'push' | 'sms' | 'email';
  recipient: ActivityRecipient | null;
  result: 'sent' | 'failed' | 'invalid-token';
  code?: string;
};

/**
 * The Журнал дій row an action of the Адміністратор платформи wrote: its `auditId`, the target whose
 * «Історія» lists it, the Салон the target is in (a Майстер салону's), and the action's name.
 */
export type ActivityAuditEffect = {
  kind: 'audit';
  auditId: string;
  target: { type: string; id: string };
  salonId: string | null;
  action: string;
};

/** What a request caused beside its answer. */
export type ActivityEffect = ActivityDeliveryEffect | ActivityAuditEffect;

/** One entry of the Журнал активності: one request, as it was answered. */
export type ActivityEntry = {
  activityId: string;
  createdAt: string;
  /** dev and staging share a table, so each entry says which stage wrote it. */
  stage: string;
  /**
   * `client-api`, `salon-api`, `master-api` or `admin-api` — or `cognito`: an account's sign-up and
   * the codes Cognito sent it.
   */
  service: string;
  /**
   * API Gateway's `routeKey`, e.g. `PATCH /client/appointments/{appointmentId}/cancel` — or, of the
   * `cognito` service, `auth.sign-up` and `auth.code-sent`.
   */
  route: string;
  /**
   * What Cognito invoked its trigger for — `PreSignUp_SignUp`, `CustomMessage_ForgotPassword` —
   * worded by `activityLog.trigger.<triggerSource>`; `null` for a request, and absent from an
   * `admin-api` that does not serve it yet.
   */
  triggerSource?: string | null;
  /** The domain of the address a Cognito trigger's entry concerns — never the address; `null` for none. */
  emailDomain?: string | null;
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
  /**
   * The body the app sent, without passwords, tokens, phones, emails or names (the backend redacts
   * them to `[REDACTED]`): the JSON itself — or, when `requestBodyTruncated`, the text of its first
   * 4 KB, which is no JSON any more. `null` for a request without a JSON body.
   */
  requestBody: unknown;
  requestBodyTruncated: boolean;
  /** `null` — the app named none: a build from before the header, or a caller that is no BookMe app. */
  client: ActivityApp | null;
  /**
   * `requestContext.requestId` — what the request's CloudWatch lines carry; for a Cognito trigger's
   * entry, the trigger's Lambda `awsRequestId`.
   */
  requestId: string;
  traceId: string | null;
  sentryEventId: string | null;
  /**
   * What the request caused, in the order it happened — each try to deliver and each Журнал дій row
   * it wrote; `[]` for an entry from before effects were kept, or from an `admin-api` that does not
   * serve them yet. At most 50 deliveries; the rest are counted in `effectsOmitted`.
   */
  effects?: ActivityEffect[];
  effectsOmitted?: number;
};

/** Who acted, as the log narrows by it: a role of the verified token, or `anonymous` — nobody signed in. */
export const ACTIVITY_ROLE_FILTERS = [
  'client',
  'salon',
  'salon_admin',
  'master',
  'admin',
  'anonymous',
] as const;
export type ActivityRoleFilter = (typeof ACTIVITY_ROLE_FILTERS)[number];

export const ACTIVITY_OUTCOMES = [
  'ok',
  'rejected',
  'failed',
] as const satisfies readonly ActivityOutcome[];

/** The services that write the log; `cognito` — an account's sign-up and the codes sent to it. */
export const ACTIVITY_SERVICES = [
  'client-api',
  'salon-api',
  'master-api',
  'admin-api',
  'cognito',
] as const;
export type ActivityService = (typeof ACTIVITY_SERVICES)[number];

/**
 * What the log is asked for. `from` inclusive, `to` exclusive — both instants; neither, and the
 * backend serves today on the platform's clock — or, for an account or a Місце, all it keeps. An
 * account is named by its id (`actorId`) or its email (`account`), never both; `placeId` is a Салон
 * or a Незалежний майстер. Without an account or a Місце the period is at most a month, and one
 * longer — or with no start — is refused with `ACTIVITY_PERIOD_TOO_LONG`.
 */
export type ActivityLogQuery = {
  from?: string;
  to?: string;
  actorId?: string;
  account?: string;
  placeId?: string;
  role?: ActivityRoleFilter;
  outcome?: ActivityOutcome;
  service?: ActivityService;
  route?: string;
};

export type ActivityPage = { items: ActivityEntry[]; nextCursor: string | null };

@Injectable({ providedIn: 'root' })
export class ActivityClient {
  private readonly http = inject(HttpClient);

  /** The Журнал активності, narrowed as asked, newest first — the «Журнал активності» screen. */
  list(query: ActivityLogQuery, cursor?: string): Observable<ActivityPage> {
    return this.http.get<ActivityPage>(adminApiUrl('/admin/activity'), {
      params: { ...query, ...(cursor ? { cursor } : {}) },
    });
  }
}
