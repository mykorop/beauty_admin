import type { SalonService, SalonServiceFields, SalonServicePatch } from '../../core/api/salon-services.client';

/** The only currency a new service may be priced in — the same rule as for the business. */
export const NEW_SERVICE_CURRENCY = 'MDL';

/** The service form as typed: numbers may be emptied. */
export type SalonServiceFormValue = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number | null;
  price: number | null;
  currency: string;
  isActive: boolean;
};

export const EMPTY_SALON_SERVICE_FORM_VALUE: SalonServiceFormValue = {
  name: '',
  description: '',
  category: '',
  durationMinutes: null,
  price: null,
  currency: NEW_SERVICE_CURRENCY,
  isActive: true,
};

export function toSalonServiceFormValue(service: SalonService): SalonServiceFormValue {
  return {
    name: service.name,
    description: service.description,
    category: service.category,
    durationMinutes: service.durationMinutes,
    price: service.price,
    currency: service.currency,
    isActive: service.isActive,
  };
}

/** The body of the POST, or `null` while a required number is still empty. */
export function toSalonServiceFields(value: SalonServiceFormValue): SalonServiceFields | null {
  if (value.durationMinutes === null || value.price === null) {
    return null;
  }
  return {
    ...value,
    name: value.name.trim(),
    description: value.description.trim(),
    durationMinutes: value.durationMinutes,
    price: value.price,
  };
}

/**
 * What the form changed against the service it was opened with — the body of the PATCH. A field
 * typed over and put back is not a change.
 */
export function buildSalonServicePatch(service: SalonService, value: SalonServiceFormValue): SalonServicePatch {
  const after: SalonServiceFields = {
    name: value.name.trim() || service.name,
    description: value.description.trim(),
    category: value.category || service.category,
    durationMinutes: value.durationMinutes ?? service.durationMinutes,
    price: value.price ?? service.price,
    currency: value.currency || service.currency,
    isActive: value.isActive,
  };
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== service[field as keyof SalonServiceFields]),
  );
}

/**
 * Ціна й тривалість belong to each Копія майстра: changing them in the Каталог changes what a new
 * Копія starts from and nothing else. The form says so the moment either is touched.
 */
export function touchesMasterOwnedFields(patch: SalonServicePatch): boolean {
  return patch.price !== undefined || patch.durationMinutes !== undefined;
}
