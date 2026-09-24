import { inject, Injectable } from '@angular/core';
import { forkJoin, map, type Observable } from 'rxjs';
import { type SalonMaster, SalonMastersClient } from '../../core/api/salon-masters.client';
import { type Salon, SalonsClient } from '../../core/api/salons.client';
import type { CardScope } from '../../shared/profile-card/card-scope';
import {
  type CardAdapter,
  type CardHeader,
  cardRoutes,
  type Loaded,
  type ProfileCardKind,
} from '../../shared/profile-card/profile-card.model';
import { ROSTER_STATUS_SEVERITY } from '../../shared/profile-status';
import { salonScope } from '../salon-card/salon-card';

/** A Майстер салону is named by the pair: the same Майстер inside another Салон is another card. */
export type SalonMasterIds = { salonId: string; masterId: string };

/**
 * How a Майстер салону's card reads and describes him — always inside his Салон: opened from the
 * Ростер and leading back to it. The Салон is read with him, and both land or the card fails: its
 * clock dates the card, and a Видалений Салон makes the card read-only.
 */
@Injectable({ providedIn: 'root' })
export class SalonMasterCardAdapter implements CardAdapter<SalonMasterIds, SalonMaster, Salon> {
  private readonly salons = inject(SalonsClient);
  private readonly masters = inject(SalonMastersClient);

  read({ salonId, masterId }: SalonMasterIds): Observable<Loaded<SalonMaster, Salon>> {
    return forkJoin([this.salons.get(salonId), this.masters.get(salonId, masterId)]).pipe(
      map(([salon, master]) => ({ profile: master, context: salon })),
    );
  }

  /** The link alone: its Салон stays as the card read it. */
  reload({ profile, context }: Loaded<SalonMaster, Salon>): Observable<SalonMaster> {
    return this.masters.get(context.salonId, profile.masterId);
  }

  header({ profile, context }: Loaded<SalonMaster, Salon>): CardHeader {
    return {
      title: profile.masterName,
      subject: profile.masterName,
      tag: {
        labelKey: `roster.status.${profile.status}`,
        severity: ROSTER_STATUS_SEVERITY[profile.status] ?? 'secondary',
      },
      active: profile.status === 'ACTIVE',
      owner: profile.isOwner,
      context: { kind: 'salon', salonId: context.salonId, name: context.name },
      deleted: context.status === 'deleted' ? { at: null } : null,
      blocked: null,
    };
  }

  scope({ profile, context }: Loaded<SalonMaster, Salon>): CardScope {
    const salon = salonScope(context);
    const base = `${salon.base}/masters/${encodeURIComponent(profile.masterId)}` as const;
    return {
      kind: 'salonMaster',
      base,
      timezone: salon.timezone,
      // The link has no Видалений of its own: his Салон's is the one that makes it read-only.
      writable: salon.writable,
      capabilities: {
        avatar: false,
        roster: null,
        scheduleBounds: { salonId: context.salonId },
        profileEdit: base,
        appointmentsThroughSalon: { salonId: context.salonId, masterId: profile.masterId },
        block: false,
        bulkCancel: false,
      },
      audit: { type: 'master', id: profile.masterId },
      reviews: { about: { salonId: context.salonId, masterId: profile.masterId } },
    };
  }
}

/** The card of one Майстер салону, opened by his Салон's id and his own. */
export const SALON_MASTER_CARD: ProfileCardKind<SalonMasterIds, SalonMaster, Salon> = {
  adapter: SalonMasterCardAdapter,
  tabs: [
    {
      path: 'profile',
      labelKey: 'salonMaster.tab.profile',
      load: () => import('./salon-master-profile.tab').then((m) => m.SalonMasterProfileTab),
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
      labelKey: 'salonMaster.tab.services',
      load: () => import('./salon-master-services.tab').then((m) => m.SalonMasterServicesTab),
    },
    {
      path: 'appointments',
      labelKey: 'salonMaster.tab.appointments',
      load: () =>
        import('../../shared/appointments/appointments.tab').then((m) => m.AppointmentsTab),
    },
    {
      path: 'reviews',
      labelKey: 'salonMaster.tab.reviews',
      load: () => import('../../shared/reviews/reviews.tab').then((m) => m.ReviewsTab),
    },
  ],
  back: {
    link: ({ context }) => `/salons/${encodeURIComponent(context.salonId)}/roster`,
    labelKey: 'salonMaster.backToRoster',
  },
  copy: {
    notFound: 'salonMaster.notFound',
    deletedBanner: 'salonMaster.salonDeletedBanner',
    deletedBannerNoDate: 'salonMaster.salonDeletedBanner',
    blockedBanner: null,
  },
};

export const SALON_MASTER_CARD_ROUTES = cardRoutes(SALON_MASTER_CARD.tabs);
