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
      // The card itself arrives with its own ticket; until then its address must at least resolve.
      {
        path: 'salons/:salonId',
        loadComponent: () => import('./pages/section-stub/section-stub.page').then((m) => m.SectionStubPage),
        data: { titleKey: 'nav.salons' },
      },
      ...NAV_SECTIONS.filter((section) => section.path !== 'salons').map((section) => ({
        path: section.path,
        loadComponent: () => import('./pages/section-stub/section-stub.page').then((m) => m.SectionStubPage),
        data: { titleKey: section.labelKey },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
