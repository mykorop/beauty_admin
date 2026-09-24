import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { filter, map, type Observable } from 'rxjs';
import { masterPath } from '../../core/api/admin-api-url';
import { type Master, MastersClient } from '../../core/api/masters.client';
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
 * How a Незалежний майстер's card reads and describes him.
 *
 * A Майстер салону reached by this address is not shown here at all — his card is the one inside
 * his Ростер, and a read that finds him on one sends the reader straight there. That is also why
 * Блокування is offered here: only a Незалежний майстер is his own listing, and only his own
 * listing can leave search.
 */
@Injectable({ providedIn: 'root' })
export class MasterCardAdapter implements CardAdapter<string, Master, null> {
  private readonly masters = inject(MastersClient);
  private readonly router = inject(Router);

  read(masterId: string): Observable<Loaded<Master, null>> {
    return this.readUnlessOnRoster(masterId).pipe(
      map((master) => ({ profile: master, context: null })),
    );
  }

  reload({ profile }: Loaded<Master, null>): Observable<Master> {
    return this.readUnlessOnRoster(profile.masterId);
  }

  header({ profile }: Loaded<Master, null>): CardHeader {
    const salon = profile.salon;
    return {
      ...profileHeader(profile, profile.name),
      context: salon && {
        kind: 'formerSalon',
        name: salon.name || salon.salonId,
        leftAt: salon.leftAt,
      },
    };
  }

  scope({ profile }: Loaded<Master, null>): CardScope {
    const base = masterPath(profile.masterId);
    return {
      kind: 'master',
      base,
      timezone: profile.timezone,
      writable: profile.status !== 'deleted',
      capabilities: {
        avatar: true,
        roster: null,
        scheduleBounds: null,
        profileEdit: base,
        appointmentsThroughSalon: null,
        block: true,
        bulkCancel: true,
      },
      audit: { type: 'master', id: profile.masterId },
      reviews: { about: { masterId: profile.masterId } },
    };
  }

  /**
   * The Майстер, unless he is on a Ростер now: that card is the one inside the Салон, and its
   * address is the real one. A read that lands after the card moved on is dropped before it gets
   * here, so it sends nobody anywhere.
   */
  private readUnlessOnRoster(masterId: string): Observable<Master> {
    return this.masters.get(masterId).pipe(
      filter((master) => {
        if (!master.salon?.current) {
          return true;
        }
        void this.router.navigate(['/salons', master.salon.salonId, 'masters', master.masterId], {
          replaceUrl: true,
        });
        return false;
      }),
    );
  }
}

/** The card of one Незалежний майстер, opened by his id. */
export const MASTER_CARD: ProfileCardKind<string, Master, null> = {
  adapter: MasterCardAdapter,
  tabs: [
    {
      path: 'profile',
      labelKey: 'salon.tab.profile',
      load: () => import('./master-profile.tab').then((m) => m.MasterProfileTab),
    },
    {
      path: 'schedule',
      labelKey: 'salonMaster.tab.schedule',
      load: () =>
        import('../../shared/working-schedule/working-schedule.tab').then(
          (m) => m.WorkingScheduleTab,
        ),
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
      path: 'history',
      labelKey: 'salon.tab.history',
      load: () => import('../../shared/audit/audit-history').then((m) => m.AuditHistory),
    },
  ],
  back: { link: () => '/independent-masters', labelKey: 'master.backToList' },
  copy: {
    notFound: 'master.notFound',
    deletedBanner: 'master.deletedBanner',
    deletedBannerNoDate: 'master.deletedBannerNoDate',
    blockedBanner: 'master.blockedBanner',
    historyEmpty: 'master.history.empty',
  },
};

export const MASTER_CARD_ROUTES = cardRoutes(MASTER_CARD.tabs);
