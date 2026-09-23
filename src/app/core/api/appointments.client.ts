import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import type { TableRun } from './table-run.model';

/** The four states of a Запис, as the business apps write them. */
export const APPOINTMENT_STATUSES = ['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_SEVERITY: Record<AppointmentStatus, 'info' | 'success' | 'secondary' | 'danger'> = {
  BOOKED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
  NO_SHOW: 'danger',
};

/** One Запис as the table of the Записи tab reads it. */
export type Appointment = {
  appointmentId: string;
  /** UTC instants; every screen prints them on the venue's clock, never the browser's. */
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  clientName: string;
  masterId: string;
  masterName: string;
  /** `null` for a Запис a Незалежний майстер took: there is no Салон behind it. */
  salonId: string | null;
  serviceNames: string[];
  totalPrice: number;
  currency: string;
  /** Ручний запис — created by the business, the only kind allowed outside the Робочий графік. */
  isManual: boolean;
};

/**
 * One Запис of a list that spans venues — a Клієнт's feed, the наскрізний список. The venue's name
 * and clock travel **on the row**, not on the page the way a card's Записи tab carries them: such a
 * list has no one venue whose clock it could be printed on.
 */
export type VenueAppointment = Appointment & {
  /** The Салон's name, or the Незалежний майстер's own — as the Запис recorded it. */
  venueName: string;
  timezone: string;
};

/** The window as it was answered, and the clock it was cut on — the venue's. */
export type AppointmentsPage = { timezone: string; items: Appointment[] };

export type AppointmentService = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: number;
};

/** Everything the card of one Запис shows — what a disputed booking is read for. */
export type AppointmentDetails = Appointment & {
  timezone: string;
  /** `null` for a walk-in: the phone number belongs to nobody with an account. */
  clientId: string | null;
  clientPhone: string;
  salonName: string | null;
  services: AppointmentService[];
  totalDurationMinutes: number;
  notes: string | null;
  /** The clock every action over this Запис carries back — see `SeenAt`. */
  updatedAt: string | null;
};

/**
 * The three states the panel may move a Запис into. «Заброньовано» is absent on purpose, as it is
 * on the backend: the platform un-cancels nothing.
 */
export const APPOINTMENT_ACTION_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const;
export type AppointmentActionStatus = (typeof APPOINTMENT_ACTION_STATUSES)[number];

/**
 * The clock the card showed, carried by every action: if the Запис has moved since — the Клієнт
 * cancelled it, the Салон shifted it — the backend refuses with `EDIT_CONFLICT` instead of
 * overwriting. `null` is a value, not a missing field: a Запис written before the attribute
 * existed has none, and the guard then demands it still be absent.
 */
export type SeenAt = { updatedAt: string | null };

/** Скасування needs a reason; closing a visit that happened may carry one. */
export type AppointmentStatusChange = SeenAt & {
  status: AppointmentActionStatus;
  reason?: string;
};

/** A перенесення: a new start on the venue's clock, and why. Nothing else moves. */
export type AppointmentRescheduleRequest = SeenAt & { startDateTime: string; reason?: string };

/**
 * One candidate start in the Майстер's day. `available` is the only selectable one — `booked` is
 * an hour already taken, `too_short` one where this Запис would run into the next.
 */
export type SlotStatus = 'available' | 'booked' | 'too_short';

export type AvailableSlot = {
  date: string;
  /** Venue-local `HH:mm` — what the button shows. */
  localTime: string;
  /** The instant the перенесення is asked for. */
  startAtUtc: string;
  utcOffset: string;
  status: SlotStatus;
};

/**
 * The day the reschedule dialog draws. The backend also answers with `bookedBlocks`,
 * `workingWindows` and `workingDayStatus` — the business apps' calendars render those — but this
 * dialog offers a list of hours, and a field declared here that nothing reads would be a promise
 * about the screen that isn't true.
 */
export type AvailableSlotsPage = {
  slotOptions: AvailableSlot[];
  timezone: string;
};

/**
 * «N майбутніх Записів» — the one number the warning on a Видалений or Заблокований card shows, and
 * the one the Блокування dialog states before it asks for anything.
 */
export type UpcomingAppointments = { count: number };

/**
 * What a масове скасування did. `remaining` is the number that answers «did it finish?»: the Записи
 * the backend refused plus whatever its per-call cap left behind. The action is idempotent, so a
 * `remaining` above zero is an invitation to press the button again, not a failure.
 */
export type BulkCancelResult = { cancelled: number; failed: number; remaining: number };

/**
 * The наскрізний список narrowed to a Салон, a Майстер or a Клієнт — at least one of them, always:
 * with nobody named the question is the whole platform, which is a day's gathering, not this read.
 * The window's days are the platform's.
 */
export type PlatformAppointmentQuery = {
  from: string;
  to: string;
  salonId?: string;
  masterId?: string;
  clientId?: string;
  status?: AppointmentStatus;
};

/**
 * Every Запис of one day of the platform, as the last gathering of that day found them — soonest
 * first. `builtAt` is when the table was read: a Запис made or moved since is not here.
 */
export type AppointmentsDay = {
  runId: string;
  date: string;
  builtAt: string;
  timeZone: string;
  scannedItems: number;
  items: VenueAppointment[];
};

/** The latest gathering of a day and its latest result — independent, as the dashboard's are. */
export type AppointmentsDayState = { run: TableRun | null; result: AppointmentsDay | null };

/** What the backend is asked for: the window is never optional, and `masterId` narrows a Салон's list. */
export type AppointmentQuery = {
  from: string;
  to: string;
  status?: AppointmentStatus;
  masterId?: string;
};

const params = (query: AppointmentQuery): Record<string, string> => ({
  from: query.from,
  to: query.to,
  ...(query.status ? { status: query.status } : {}),
  ...(query.masterId ? { masterId: query.masterId } : {}),
});

/**
 * Записи as the panel reads and acts on them. There is deliberately nothing here that **creates**
 * one: the platform never books instead of the business, and the backend has no endpoint for it
 * either. What it does have is the three actions over a Запис that already exists.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsClient {
  private readonly http = inject(HttpClient);

  /** Записи of one Салон, every Майстер of the Ростер included; `masterId` narrows it to one. */
  salon(salonId: string, query: AppointmentQuery): Observable<AppointmentsPage> {
    return this.http.get<AppointmentsPage>(
      adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/appointments`),
      { params: params(query) },
    );
  }

  /** Записи a Незалежний майстер took on his own; the ones he took in a Салон belong to its card. */
  master(masterId: string, query: AppointmentQuery): Observable<AppointmentsPage> {
    return this.http.get<AppointmentsPage>(
      adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/appointments`),
      { params: params(query) },
    );
  }

  /**
   * The наскрізний список narrowed to a Салон, a Майстер or a Клієнт: a read of that one's own
   * partition, answered at once.
   */
  platform(query: PlatformAppointmentQuery): Observable<{ items: VenueAppointment[] }> {
    return this.http.get<{ items: VenueAppointment[] }>(adminApiUrl('/admin/appointments'), {
      params: { ...query },
    });
  }

  /** The latest gathering of one day of the platform and what it found — what the page polls. */
  day(date: string): Observable<AppointmentsDayState> {
    return this.http.get<AppointmentsDayState>(adminApiUrl('/admin/appointments/day'), {
      params: { date },
    });
  }

  /**
   * Gathers every Запис of one day of the platform — a read of the whole table, done by a backend
   * worker — and answers with the run to follow. While that day is being gathered, the backend
   * hands back the run already under way.
   */
  startDay(date: string): Observable<TableRun> {
    return this.http.post<TableRun>(adminApiUrl('/admin/appointments/day'), { date });
  }

  /**
   * One Запис in full. A row that vanished between the list and the click is the tab's own message,
   * not a toast, so `NOT_FOUND` is left to the caller.
   */
  details(appointmentId: string): Observable<AppointmentDetails> {
    return this.http.get<AppointmentDetails>(
      adminApiUrl(`/admin/appointments/${encodeURIComponent(appointmentId)}`),
      { context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']) },
    );
  }

  /**
   * Скасовано / завершено / не з'явився. Answers with the whole Запис, so the row that asked can
   * redraw from the answer rather than from what it hoped the action did.
   */
  updateStatus(appointmentId: string, change: AppointmentStatusChange): Observable<AppointmentDetails> {
    return this.http.patch<AppointmentDetails>(
      adminApiUrl(`/admin/appointments/${encodeURIComponent(appointmentId)}`),
      change,
    );
  }

  /** The same Запис at another hour — one `availableSlots` has already called free. */
  reschedule(
    appointmentId: string,
    request: AppointmentRescheduleRequest,
  ): Observable<AppointmentDetails> {
    return this.http.patch<AppointmentDetails>(
      adminApiUrl(`/admin/appointments/${encodeURIComponent(appointmentId)}/reschedule`),
      request,
    );
  }

  /** How many Записи the Салон still has ahead of it — the card warning and the block dialog. */
  salonUpcomingCount(salonId: string): Observable<UpcomingAppointments> {
    return this.http.get<UpcomingAppointments>(
      adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/appointments/upcoming-count`),
    );
  }

  /**
   * Every future Запис of the Салон called off with one reason. Allowed over a Видалений Салон —
   * that is the profile the exception exists for.
   */
  cancelSalonUpcoming(salonId: string, reason: string): Observable<BulkCancelResult> {
    return this.http.post<BulkCancelResult>(
      adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/appointments/cancel-upcoming`),
      { reason },
    );
  }

  /** The twin of `salonUpcomingCount`, over the Записи a Незалежний майстер took on his own. */
  masterUpcomingCount(masterId: string): Observable<UpcomingAppointments> {
    return this.http.get<UpcomingAppointments>(
      adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/appointments/upcoming-count`),
    );
  }

  /** The twin of `cancelSalonUpcoming`. */
  cancelMasterUpcoming(masterId: string, reason: string): Observable<BulkCancelResult> {
    return this.http.post<BulkCancelResult>(
      adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/appointments/cancel-upcoming`),
      { reason },
    );
  }

  /**
   * One day of the Майстер's calendar for the reschedule dialog, this Запис left out of it. A day
   * the backend refuses (one already past) is the dialog's own message, not a toast.
   */
  availableSlots(appointmentId: string, date: string): Observable<AvailableSlotsPage> {
    return this.http.get<AvailableSlotsPage>(
      adminApiUrl(`/admin/appointments/${encodeURIComponent(appointmentId)}/available-slots`),
      {
        params: { date },
        context: new HttpContext().set(SILENT_ERROR_CODES, ['BAD_REQUEST', 'NOT_FOUND']),
      },
    );
  }
}
