import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { salonPath } from '../../core/api/admin-api-url';
import { type Salon, SalonsClient } from '../../core/api/salons.client';
import type { CardScope } from '../../shared/profile-card/card-scope';
import {
  type CardAdapter,
  type CardHeader,
  cardRoutes,
  type Loaded,
  type ProfileCardKind,
} from '../../shared/profile-card/profile-card.model';
import { profileHeader } from '../../shared/profile-status';

/**
 * The scope of a Салон's card. Exported, because it is also how a Майстер салону's card names the
 * Салон he works in: the Години роботи his week stays inside, the Каталог his Копії come from.
 */
export function salonScope(salon: Salon): CardScope {
  const base = salonPath(salon.salonId);
  return {
    kind: 'salon',
    base,
    timezone: salon.timezone,
    writable: salon.status !== 'deleted',
    capabilities: {
      avatar: false,
      roster: { salonId: salon.salonId },
      scheduleBounds: null,
      profileEdit: `${base}/profile`,
      appointmentsThroughSalon: null,
      block: true,
      bulkCancel: true,
    },
    audit: { type: 'salon', id: salon.salonId },
    reviews: { about: { salonId: salon.salonId } },
  };
}

/** How a Салон's card reads and describes it. */
@Injectable({ providedIn: 'root' })
export class SalonCardAdapter implements CardAdapter<string, Salon, null> {
  private readonly salons = inject(SalonsClient);

  read(salonId: string): Observable<Loaded<Salon, null>> {
    return this.salons.get(salonId).pipe(map((salon) => ({ profile: salon, context: null })));
  }

  reload({ profile }: Loaded<Salon, null>): Observable<Salon> {
    return this.salons.get(profile.salonId);
  }

  header({ profile }: Loaded<Salon, null>): CardHeader {
    return profileHeader(profile, profile.name);
  }

  scope({ profile }: Loaded<Salon, null>): CardScope {
    return salonScope(profile);
  }
}

/** The card of one Салон, opened by its id. */
export const SALON_CARD: ProfileCardKind<string, Salon, null> = {
  adapter: SalonCardAdapter,
  tabs: [
    {
      path: 'profile',
      labelKey: 'salon.tab.profile',
      load: () => import('./salon-profile.tab').then((m) => m.SalonProfileTab),
    },
    {
      path: 'hours',
      labelKey: 'salon.tab.hours',
      load: () => import('./salon-hours.tab').then((m) => m.SalonHoursTab),
    },
    {
      path: 'roster',
      labelKey: 'salon.tab.roster',
      load: () => import('./salon-roster.tab').then((m) => m.SalonRosterTab),
    },
    {
      path: 'services',
      labelKey: 'salon.tab.services',
      load: () =>
        import('../../shared/service-catalog/service-catalog.tab').then((m) => m.ServiceCatalogTab),
    },
    {
      path: 'appointments',
      labelKey: 'salon.tab.appointments',
      load: () =>
        import('../../shared/appointments/appointments.tab').then((m) => m.AppointmentsTab),
    },
    {
      path: 'reviews',
      labelKey: 'salon.tab.reviews',
      load: () => import('../../shared/reviews/reviews.tab').then((m) => m.ReviewsTab),
    },
    {
      path: 'media',
      labelKey: 'salon.tab.media',
      load: () => import('../../shared/media/media.tab').then((m) => m.MediaTab),
    },
    {
      path: 'invites',
      labelKey: 'salon.tab.invites',
      load: () => import('./salon-invites.tab').then((m) => m.SalonInvitesTab),
    },
    {
      path: 'history',
      labelKey: 'salon.tab.history',
      load: () => import('../../shared/audit/audit-history').then((m) => m.AuditHistory),
    },
  ],
  back: { link: () => '/salons', labelKey: 'salon.backToList' },
  copy: {
    notFound: 'salon.notFound',
    deletedBanner: 'salon.deletedBanner',
    deletedBannerNoDate: 'salon.deletedBannerNoDate',
    blockedBanner: 'salon.blockedBanner',
  },
};

export const SALON_CARD_ROUTES = cardRoutes(SALON_CARD.tabs);
