import type { SalonMaster, SalonMasterFields, SalonMasterPatch } from '../../core/api/salon-masters.client';

/** The edit form as typed: numbers may be emptied. */
export type SalonMasterFormValue = {
  specialization: string;
  commissionPercent: number | null;
  bookingForwardDays: number | null;
};

export function toSalonMasterFormValue(master: SalonMaster): SalonMasterFormValue {
  return {
    specialization: master.specialization,
    commissionPercent: master.commissionPercent,
    bookingForwardDays: master.bookingForwardDays,
  };
}

/**
 * What the form changed against the link it was opened with — the body of the PATCH. A field typed
 * over and put back is not a change. The link's status is not a field of this form at all.
 */
export function buildSalonMasterPatch(master: SalonMaster, value: SalonMasterFormValue): SalonMasterPatch {
  const after: SalonMasterFields = {
    specialization: value.specialization || master.specialization,
    commissionPercent: value.commissionPercent ?? master.commissionPercent,
    bookingForwardDays: value.bookingForwardDays ?? master.bookingForwardDays,
  };
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== master[field as keyof SalonMasterFields]),
  );
}
