import type { CatalogService, CatalogServiceFields, CatalogServicePatch } from './service-catalog.model';

/** The only currency a new service may be priced in — the same rule as for the business. */
export const NEW_SERVICE_CURRENCY = 'MDL';

/** The service form as typed: numbers may be emptied. */
export type CatalogServiceFormValue = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number | null;
  price: number | null;
  currency: string;
  isActive: boolean;
};

export const EMPTY_CATALOG_SERVICE_FORM_VALUE: CatalogServiceFormValue = {
  name: '',
  description: '',
  category: '',
  durationMinutes: null,
  price: null,
  currency: NEW_SERVICE_CURRENCY,
  isActive: true,
};

export function toCatalogServiceFormValue(service: CatalogService): CatalogServiceFormValue {
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
export function toCatalogServiceFields(value: CatalogServiceFormValue): CatalogServiceFields | null {
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
export function buildCatalogServicePatch(service: CatalogService, value: CatalogServiceFormValue): CatalogServicePatch {
  const after: CatalogServiceFields = {
    name: value.name.trim() || service.name,
    description: value.description.trim(),
    category: value.category || service.category,
    durationMinutes: value.durationMinutes ?? service.durationMinutes,
    price: value.price ?? service.price,
    currency: value.currency || service.currency,
    isActive: value.isActive,
  };
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== service[field as keyof CatalogServiceFields]),
  );
}

/**
 * Ціна й тривалість belong to each Копія майстра: changing them in the Каталог Салону changes what
 * a new Копія starts from and nothing else. The form says so the moment either is touched — but only
 * where Копії can exist at all, which is why the warning is a property of the Каталог, not of the
 * patch: a Незалежний майстер has no Ростер under him, so his own price is the one Клієнти book at.
 */
export function touchesMasterOwnedFields(patch: CatalogServicePatch): boolean {
  return patch.price !== undefined || patch.durationMinutes !== undefined;
}
