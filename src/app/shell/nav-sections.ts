import type { TranslationKey } from '../i18n/translations';

export type NavSection = {
  /** Route path under the shell, without a leading slash. */
  path: string;
  labelKey: TranslationKey;
  icon: string;
};

/**
 * The sidebar, top to bottom. Every section has its own route in `app.routes.ts` — «Записи» was the
 * last to stop being a placeholder — and the first one is where an empty address lands.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  { path: 'dashboard', labelKey: 'nav.dashboard', icon: 'pi pi-chart-bar' },
  { path: 'salons', labelKey: 'nav.salons', icon: 'pi pi-building' },
  { path: 'independent-masters', labelKey: 'nav.independentMasters', icon: 'pi pi-user' },
  { path: 'clients', labelKey: 'nav.clients', icon: 'pi pi-users' },
  { path: 'appointments', labelKey: 'nav.appointments', icon: 'pi pi-calendar' },
  { path: 'reviews', labelKey: 'nav.reviews', icon: 'pi pi-star' },
  { path: 'audit-log', labelKey: 'nav.auditLog', icon: 'pi pi-history' },
];
