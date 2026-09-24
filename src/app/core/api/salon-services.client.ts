import type { CatalogService } from '../../shared/service-catalog/service-catalog.model';

/**
 * One послуга of the Каталог послуг of a Салон, as `ServiceCatalogClient` reads it at the Салон's
 * path: the shared catalog service, which always knows how many Майстри hold a Копія майстра of it
 * — only a Салон has a Ростер under its Каталог. The Копії screens take their offer from it.
 */
export type SalonService = CatalogService & { masterCopyCount: number };
