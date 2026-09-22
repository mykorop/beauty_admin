import type { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { NAV_SECTIONS } from './shell/nav-sections';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: NAV_SECTIONS[0].path },
      {
        path: 'salons',
        loadComponent: () => import('./pages/salons/salons.page').then((m) => m.SalonsPage),
      },
      // Before the salon card: its own tab routes end in a wildcard that would swallow this path.
      {
        path: 'salons/:salonId/masters/:masterId',
        loadComponent: () =>
          import('./pages/salon-master-card/salon-master-card.page').then((m) => m.SalonMasterCardPage),
        loadChildren: () =>
          import('./pages/salon-master-card/salon-master-card.tabs').then((m) => m.SALON_MASTER_CARD_ROUTES),
      },
      {
        path: 'salons/:salonId',
        loadComponent: () => import('./pages/salon-card/salon-card.page').then((m) => m.SalonCardPage),
        loadChildren: () => import('./pages/salon-card/salon-card.tabs').then((m) => m.SALON_CARD_ROUTES),
      },
      {
        path: 'independent-masters',
        loadComponent: () => import('./pages/masters/masters.page').then((m) => m.MastersPage),
      },
      {
        path: 'independent-masters/:masterId',
        loadComponent: () => import('./pages/master-card/master-card.page').then((m) => m.MasterCardPage),
        loadChildren: () => import('./pages/master-card/master-card.tabs').then((m) => m.MASTER_CARD_ROUTES),
      },
      {
        path: 'clients',
        loadComponent: () => import('./pages/clients/clients.page').then((m) => m.ClientsPage),
      },
      {
        path: 'clients/:clientId',
        loadComponent: () => import('./pages/client-card/client-card.page').then((m) => m.ClientCardPage),
        loadChildren: () => import('./pages/client-card/client-card.tabs').then((m) => m.CLIENT_CARD_ROUTES),
      },
      {
        path: 'reviews',
        loadComponent: () => import('./pages/reviews/reviews.page').then((m) => m.ReviewsPage),
      },
      {
        path: 'audit-log',
        loadComponent: () => import('./pages/audit-log/audit-log.page').then((m) => m.AuditLogPage),
      },
      ...NAV_SECTIONS.filter(
        (section) => !['salons', 'independent-masters', 'clients', 'reviews', 'audit-log'].includes(section.path),
      ).map((section) => ({
        path: section.path,
        loadComponent: () => import('./pages/section-stub/section-stub.page').then((m) => m.SectionStubPage),
        data: { titleKey: section.labelKey },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
