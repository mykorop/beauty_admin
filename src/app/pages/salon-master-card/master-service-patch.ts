import type { MasterService, MasterServicePatch } from '../../core/api/salon-master-services.client';
import type { SalonService } from '../../core/api/salon-services.client';

/** The Копія form as typed: numbers may be emptied. */
export type MasterServiceFormValue = {
  /** Chosen only when adding; an existing Копія never changes its service. */
  serviceId: string;
  durationMinutes: number | null;
  price: number | null;
  isActive: boolean;
};

export const EMPTY_MASTER_SERVICE_FORM_VALUE: MasterServiceFormValue = {
  serviceId: '',
  durationMinutes: null,
  price: null,
  isActive: true,
};

export function toMasterServiceFormValue(copy: MasterService): MasterServiceFormValue {
  return {
    serviceId: copy.serviceId,
    durationMinutes: copy.durationMinutes,
    price: copy.price,
    isActive: copy.isActive,
  };
}

/** A new Копія starts from what the Каталог holds — the administrator then types the master's own. */
export function fromCatalogService(service: SalonService): MasterServiceFormValue {
  return {
    serviceId: service.serviceId,
    durationMinutes: service.durationMinutes,
    price: service.price,
    isActive: true,
  };
}

/** The body of the POST, or `null` while something required is still empty. */
export function toNewMasterService(
  value: MasterServiceFormValue,
): { serviceId: string; price: number; durationMinutes: number } | null {
  if (!value.serviceId || value.durationMinutes === null || value.price === null) {
    return null;
  }
  return { serviceId: value.serviceId, price: value.price, durationMinutes: value.durationMinutes };
}

/**
 * What the form changed against the Копія it was opened with — the body of the PATCH. A field typed
 * over and put back is not a change.
 */
export function buildMasterServicePatch(copy: MasterService, value: MasterServiceFormValue): MasterServicePatch {
  const after = {
    price: value.price ?? copy.price,
    durationMinutes: value.durationMinutes ?? copy.durationMinutes,
    isActive: value.isActive,
  };
  return Object.fromEntries(
    Object.entries(after).filter(([field, next]) => next !== copy[field as keyof typeof after]),
  );
}

/** Каталог services the master holds no Копія of yet — active ones first, each group by name. */
export function servicesWithoutCopy(
  catalog: readonly SalonService[],
  copies: readonly MasterService[],
  locale: string,
): SalonService[] {
  const held = new Set(copies.map((copy) => copy.serviceId));
  return catalog
    .filter((service) => !held.has(service.serviceId))
    .sort(
      (left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name, locale),
    );
}

/**
 * Whether a Клієнт can book the Копія: its own switch AND the Каталог's — the same rule the
 * backend's offer reads apply. A Копія whose Каталог service is gone is offered by nobody.
 */
export function isOffered(copy: MasterService): boolean {
  return copy.isActive && copy.catalog?.isActive === true;
}
