import type { Salon, SalonProfileFields, SalonProfilePatch } from '../../core/api/salons.client';

/** The edit form as typed: numbers may be emptied, the brand colour is `''` when there is none. */
export type SalonProfileFormValue = {
  name: string;
  description: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressCityCode: string;
  addressZipCode: string;
  phone: string;
  bufferMinutes: number | null;
  bookingForwardDays: number | null;
  brandColor: string;
};

export function toSalonProfileFormValue(salon: Salon): SalonProfileFormValue {
  return {
    name: salon.name,
    description: salon.description,
    addressStreet: salon.addressStreet,
    addressHouseNumber: salon.addressHouseNumber,
    addressCityCode: salon.addressCityCode,
    addressZipCode: salon.addressZipCode,
    phone: salon.phone,
    bufferMinutes: salon.bufferMinutes,
    bookingForwardDays: salon.bookingForwardDays,
    brandColor: salon.brandColor ?? '',
  };
}

function toFields(value: SalonProfileFormValue, fallback: Salon): SalonProfileFields {
  return {
    name: value.name.trim(),
    description: value.description.trim(),
    addressStreet: value.addressStreet.trim(),
    addressHouseNumber: value.addressHouseNumber.trim(),
    addressCityCode: value.addressCityCode.trim(),
    addressZipCode: value.addressZipCode.trim(),
    phone: value.phone.trim(),
    bufferMinutes: value.bufferMinutes ?? fallback.bufferMinutes,
    bookingForwardDays: value.bookingForwardDays ?? fallback.bookingForwardDays,
    brandColor: value.brandColor.trim() || null,
  };
}

/**
 * What the form changed against the salon it was opened with — the body of the PATCH. A field
 * typed over and put back is not a change; an emptied brand colour is `null`.
 */
export function buildSalonProfilePatch(salon: Salon, value: SalonProfileFormValue): SalonProfilePatch {
  const before = toFields(toSalonProfileFormValue(salon), salon);
  const after = toFields(value, salon);
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== before[field as keyof SalonProfileFields]),
  );
}
