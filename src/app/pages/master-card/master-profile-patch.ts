import type { Master, MasterProfileFields, MasterProfilePatch } from '../../core/api/masters.client';

/** The edit form as typed: numbers may be emptied, the brand colour is `''` when there is none. */
export type MasterProfileFormValue = {
  name: string;
  description: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressCityCode: string;
  addressZipCode: string;
  phone: string;
  specialization: string;
  bufferMinutes: number | null;
  bookingForwardDays: number | null;
  brandColor: string;
};

export function toMasterProfileFormValue(master: Master): MasterProfileFormValue {
  return {
    name: master.name,
    description: master.description,
    addressStreet: master.addressStreet,
    addressHouseNumber: master.addressHouseNumber,
    addressCityCode: master.addressCityCode,
    addressZipCode: master.addressZipCode,
    phone: master.phone,
    specialization: master.specialization,
    bufferMinutes: master.bufferMinutes,
    bookingForwardDays: master.bookingForwardDays,
    brandColor: master.brandColor ?? '',
  };
}

function toFields(value: MasterProfileFormValue, fallback: Master): MasterProfileFields {
  return {
    name: value.name.trim(),
    description: value.description.trim(),
    addressStreet: value.addressStreet.trim(),
    addressHouseNumber: value.addressHouseNumber.trim(),
    addressCityCode: value.addressCityCode.trim(),
    addressZipCode: value.addressZipCode.trim(),
    phone: value.phone.trim(),
    specialization: value.specialization,
    bufferMinutes: value.bufferMinutes ?? fallback.bufferMinutes,
    bookingForwardDays: value.bookingForwardDays ?? fallback.bookingForwardDays,
    brandColor: value.brandColor.trim() || null,
  };
}

/**
 * What the form changed against the master it was opened with — the body of the PATCH. A field
 * typed over and put back is not a change; an emptied brand colour is `null`.
 */
export function buildMasterProfilePatch(master: Master, value: MasterProfileFormValue): MasterProfilePatch {
  const before = toFields(toMasterProfileFormValue(master), master);
  const after = toFields(value, master);
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== before[field as keyof MasterProfileFields]),
  );
}
