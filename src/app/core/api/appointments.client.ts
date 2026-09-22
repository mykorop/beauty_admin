import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';

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
};

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
 * Записи as the panel reads them — and only reads them. There is deliberately nothing here that
 * creates one: the platform never books instead of the business, and the backend has no endpoint
 * for it either.
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
   * One Запис in full. A row that vanished between the list and the click is the tab's own message,
   * not a toast, so `NOT_FOUND` is left to the caller.
   */
  details(appointmentId: string): Observable<AppointmentDetails> {
    return this.http.get<AppointmentDetails>(
      adminApiUrl(`/admin/appointments/${encodeURIComponent(appointmentId)}`),
      { context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']) },
    );
  }
}
