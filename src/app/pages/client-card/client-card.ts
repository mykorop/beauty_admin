import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { clientPath } from '../../core/api/admin-api-url';
import { type Client, ClientsClient } from '../../core/api/clients.client';
import type { CardScope } from '../../shared/profile-card/card-scope';
import {
  type CardAdapter,
  type CardHeader,
  cardRoutes,
  type Loaded,
  type ProfileCardKind,
} from '../../shared/profile-card/profile-card.model';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { profileHeader } from '../../shared/profile-status';

/**
 * How a Клієнт's card reads and describes him.
 *
 * A Клієнт is no Місце: his scope has Блокування, Записи, Відгуки and «Історія», and nothing else.
 * Блокування is offered for the same reason it is on the other cards — it is about the whole
 * profile — but what it does is narrower, and the dialog says so: the person keeps signing in,
 * keeps their Записи and is only refused a new booking. There is deliberately **no** масове
 * скасування beside it: cancelling a person's visits is a decision for the businesses that took
 * them, not for the platform.
 *
 * There is no venue clock either: a Клієнт belongs to no place, and his Записи may span several.
 * Everything dated **about him** is the platform's own clock, as on every screen that spans venues;
 * each Запис of his feed is dated on the clock it was booked under, which travels on its own row.
 */
@Injectable({ providedIn: 'root' })
export class ClientCardAdapter implements CardAdapter<string, Client, null> {
  private readonly clients = inject(ClientsClient);

  read(clientId: string): Observable<Loaded<Client, null>> {
    return this.clients.get(clientId).pipe(map((client) => ({ profile: client, context: null })));
  }

  header({ profile }: Loaded<Client, null>): CardHeader {
    return profileHeader(profile, profile.name, profile.name || profile.email);
  }

  scope({ profile }: Loaded<Client, null>): CardScope {
    return {
      kind: 'client',
      base: clientPath(profile.clientId),
      timezone: PLATFORM_TIME_ZONE,
      writable: profile.status !== 'deleted',
      capabilities: {
        avatar: false,
        roster: null,
        scheduleBounds: null,
        profileEdit: null,
        appointmentsThroughSalon: null,
        block: true,
        bulkCancel: false,
      },
      audit: { type: 'client', id: profile.clientId },
      reviews: { writtenBy: profile.clientId },
    };
  }
}

/**
 * The card of one Клієнт is the shortest of them, and deliberately: there is no «Каталог», no
 * «Робочий графік» and no edit — a person is not a business. What is here is what answers «що ця
 * людина робила»: who they are, where they booked, what they wrote, and what the platform did.
 */
export const CLIENT_CARD: ProfileCardKind<string, Client, null> = {
  adapter: ClientCardAdapter,
  tabs: [
    {
      path: 'profile',
      labelKey: 'salon.tab.profile',
      load: () => import('./client-profile.tab').then((m) => m.ClientProfileTab),
    },
    {
      path: 'appointments',
      labelKey: 'salon.tab.appointments',
      load: () => import('./client-appointments.tab').then((m) => m.ClientAppointmentsTab),
    },
    {
      path: 'reviews',
      labelKey: 'salon.tab.reviews',
      load: () => import('../../shared/reviews/reviews.tab').then((m) => m.ReviewsTab),
    },
    {
      path: 'history',
      labelKey: 'salon.tab.history',
      load: () => import('../../shared/audit/audit-history').then((m) => m.AuditHistory),
    },
  ],
  back: { link: () => '/clients', labelKey: 'client.backToList' },
  copy: {
    notFound: 'client.notFound',
    deletedBanner: 'client.deletedBanner',
    deletedBannerNoDate: 'client.deletedBannerNoDate',
    blockedBanner: 'client.blockedBanner',
    historyEmpty: 'client.history.empty',
  },
};

export const CLIENT_CARD_ROUTES = cardRoutes(CLIENT_CARD.tabs);
