import type { Appointment, AppointmentDetails } from '../../core/api/appointments.client';

/**
 * What an action over a Запис changes in the row it was opened from.
 *
 * Both Записи tables redraw the row from the action's own answer rather than re-reading their
 * feed — a re-read under a status filter would drop the row from under the card still showing it —
 * and both therefore need the same narrowing of the card back down to a row. One copy, because two
 * would diverge silently: a field left out here is simply a cell that quietly stops updating.
 */
export function appointmentRowPatch(details: AppointmentDetails): Partial<Appointment> {
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
