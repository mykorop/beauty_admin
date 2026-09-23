import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type Observable, ReplaySubject, Subscription } from 'rxjs';
import {
  type Appointment,
  type AppointmentDetails,
  AppointmentsClient,
} from '../../core/api/appointments.client';

/** The Запис open in a list, as far as its read has got. */
export type OpenedAppointment = {
  appointmentId: string;
  /** The whole Запис; `null` while it is being read, and after the read failed. */
  details: AppointmentDetails | null;
  /** This opening's read failed — the next opening starts over with its own. */
  failed: boolean;
};

/**
 * One list of Записи and the one Запис open in it: which is open, the read of its details, and
 * where the answer of an action over it lands.
 *
 * The list keeps changing under a slow answer — another Запис is opened, the open one closed, the
 * filters changed — so every answer is bound to what asked for it:
 *
 * - A details read belongs to its opening. Opening another Запис, or closing this one, drops it:
 *   neither its answer nor its failure reaches the next opening, and a closed Запис stays closed.
 * - An action's answer belongs to the list it was taken in and to its own Запис. Its row takes it
 *   even if the row has been closed since, and the details take it while that Запис is the one
 *   open — never another's, and a closed one is not reopened for it. A list shown since — another
 *   target, other filters, a new answer — is left as it was read.
 * - A page appended to the list shown is the same list read further, not a new one: the open Запис
 *   stays open, and an answer to an action taken before the page came still lands.
 *
 * The row is redrawn from the answer, never re-read: under a «заброньовано» filter a re-read would
 * drop a Запис just cancelled from under the card still showing it.
 *
 * Whose Записи these are, how they are fetched and how their rows are printed is the list's own — a
 * venue's window, a Клієнт's history by cursor, a platform day or window; the list only says when
 * it shows a new one. Provided by the list, so the actions under its open Запис reach it too; a
 * Запис's own reads and actions are addressed by its id alone, whichever list it was opened from.
 */
@Injectable()
export class AppointmentInteraction<R extends Appointment = Appointment> {
  private readonly client = inject(AppointmentsClient);

  private readonly shown = signal<R[] | null>(null);
  private readonly openedNow = signal<OpenedAppointment | null>(null);

  /** The list as shown: what it was given, with every action answered in it since. */
  readonly rows = this.shown.asReadonly();
  /** The Запис open, or `null`. */
  readonly opened = this.openedNow.asReadonly();

  /** Counts the lists shown: an action's answer is matched to the one it was taken in. */
  private listShown = 0;
  private detailsRead = Subscription.EMPTY;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detailsRead.unsubscribe());
  }

  /**
   * A new list — `null` while it is being read. The open Запис closes, and nothing asked in the
   * last list reaches this one.
   */
  show(rows: R[] | null): void {
    this.listShown++;
    this.close();
    this.shown.set(rows);
  }

  /**
   * The list shown, read one page further — or its first page, on a list shown as `null` while it
   * was read. Not a new list (see above).
   */
  append(rows: R[]): void {
    this.shown.update((shown) => [...(shown ?? []), ...rows]);
  }

  /** Opens the Запис, or closes it if it is the one open. */
  toggle(appointmentId: string): void {
    if (this.isOpen(appointmentId)) {
      this.close();
    } else {
      this.open(appointmentId);
    }
  }

  isOpen(appointmentId: string): boolean {
    return this.opened()?.appointmentId === appointmentId;
  }

  /**
   * Sends an action over a Запис of this list and takes in its answer — the whole Запис as the
   * action left it. The returned answer is the caller's to end its own wait on; the list takes it
   * in whether or not anyone still listens. A refusal changes nothing here: the interceptor has
   * already worded it.
   */
  act(action: Observable<AppointmentDetails>): Observable<AppointmentDetails> {
    const listShown = this.listShown;
    const answer = new ReplaySubject<AppointmentDetails>(1);
    // Never dropped, not even with the tab: a change the backend was asked for is not undone by
    // leaving, and its refusal is still worded wherever the administrator is by then.
    action.subscribe({
      next: (updated) => {
        this.absorb(updated, listShown);
        answer.next(updated);
      },
      error: (error: unknown) => answer.error(error),
      complete: () => answer.complete(),
    });
    return answer.asObservable();
  }

  private open(appointmentId: string): void {
    this.detailsRead.unsubscribe();
    this.openedNow.set({ appointmentId, details: null, failed: false });
    this.detailsRead = this.client.details(appointmentId).subscribe({
      next: (details) => this.openedNow.set({ appointmentId, details, failed: false }),
      // Including a Запис that has since vanished: the row says so instead of a toast.
      error: () => this.openedNow.set({ appointmentId, details: null, failed: true }),
    });
  }

  private close(): void {
    this.detailsRead.unsubscribe();
    this.openedNow.set(null);
  }

  private absorb(updated: AppointmentDetails, listShown: number): void {
    if (listShown !== this.listShown) {
      return;
    }
    this.shown.update(
      (rows) =>
        rows?.map((row) =>
          row.appointmentId === updated.appointmentId
            ? { ...row, ...appointmentRowPatch(updated) }
            : row,
        ) ?? rows,
    );
    if (this.isOpen(updated.appointmentId)) {
      // The row and the details now say the same; a read still under way would part them again.
      this.detailsRead.unsubscribe();
      this.openedNow.set({ appointmentId: updated.appointmentId, details: updated, failed: false });
    }
  }
}

/**
 * What an action over a Запис changes in its row: the card narrowed back down to the row's
 * fields. A field left out here is a cell that quietly stops updating. What a row of a list that
 * spans venues carries besides — its venue's name and clock — is the row's own and is kept.
 */
function appointmentRowPatch(details: AppointmentDetails): Partial<Appointment> {
  return {
    startTime: details.startTime,
    endTime: details.endTime,
    status: details.status,
    masterId: details.masterId,
    masterName: details.masterName,
    serviceNames: details.services.map((service) => service.name),
    totalPrice: details.totalPrice,
    currency: details.currency,
    isManual: details.isManual,
  };
}
