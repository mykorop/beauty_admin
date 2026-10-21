/**
 * One послуга of a Каталог послуг as the table and the form read it — the Салон's (`/admin/salons/…`)
 * or a Незалежний майстер's own (`/admin/masters/…`). The two answers differ in exactly one field,
 * and this is it: a Салон's service says how many Майстри hold a Копія майстра of it, a Незалежний
 * майстер's cannot, because there is no Ростер under his Каталог.
 */
export type CatalogService = {
  serviceId: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  /** The stored price as typed — per hour when `priceUnit` is `PER_HOUR`. */
  price: number;
  currency: string;
  priceUnit: string;
  isActive: boolean;
  /** Майстри on the Ростер holding a Копія майстра of this service; absent for a Незалежний майстер. */
  masterCopyCount?: number;
  /** The same Майстри by name, A–Z; absent for a Незалежний майстер. */
  masterCopies?: { masterId: string; masterName: string }[];
  createdAt: string;
  /** Goes back as-is with a PATCH. */
  updatedAt: string;
};

/**
 * How many Записи each service has had, ever, by `serviceId` — every state but Скасований and
 * Неявка; a service nobody booked is absent. Only a list carries it: a write changes no Запис.
 */
export type ServiceBookingCounts = Record<string, number>;

/** What the administrator may change on a service of a Каталог. */
export type CatalogServiceFields = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
};

/** Only the fields that changed, never the whole form. */
export type CatalogServicePatch = Partial<CatalogServiceFields>;
