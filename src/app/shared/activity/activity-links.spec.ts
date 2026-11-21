import { actorCardLink, auditRowLink, pathIdsOf, placeCardLink, recipientCardLink } from './activity-links';

describe('actorCardLink', () => {
  it('leads to the card of a Клієнт, a Власник (his Основний салон) and a Майстер', () => {
    expect(actorCardLink({ id: 'c-1', role: 'client', name: null })).toEqual(['/clients', 'c-1']);
    expect(actorCardLink({ id: 'o-1', role: 'salon', name: null })).toEqual(['/salons', 'o-1']);
    expect(actorCardLink({ id: 'm-1', role: 'master', name: null })).toEqual(['/independent-masters', 'm-1']);
  });

  it('leads nowhere for whoever has no card: an Адміністратор, the Адміністратор платформи, a role it does not know', () => {
    expect(actorCardLink({ id: 'a-1', role: 'salon_admin', name: 'Olena' })).toBeNull();
    expect(actorCardLink({ id: 'admin-sub', role: 'admin', name: null })).toBeNull();
    expect(actorCardLink({ id: 'x-1', role: 'someone-new', name: null })).toBeNull();
  });
});

describe('recipientCardLink', () => {
  it('leads to the card of the account told, by the role it was addressed to', () => {
    expect(recipientCardLink({ id: 'o-1', role: 'salon' })).toEqual(['/salons', 'o-1']);
    expect(recipientCardLink({ id: 'c-1', role: 'client' })).toEqual(['/clients', 'c-1']);
  });

  it('leads nowhere for a role its sender did not know, or one with no card', () => {
    expect(recipientCardLink({ id: 'u-1', role: null })).toBeNull();
    expect(recipientCardLink({ id: 'a-1', role: 'salon_admin' })).toBeNull();
  });
});

describe('placeCardLink', () => {
  it('leads to the card of a Салон or of a Майстер', () => {
    expect(placeCardLink({ type: 'salon', id: 's-1', name: null })).toEqual(['/salons', 's-1']);
    expect(placeCardLink({ type: 'master', id: 'm-1', name: 'Nina' })).toEqual(['/independent-masters', 'm-1']);
  });
});

describe('pathIdsOf', () => {
  const entry = (
    pathParams: Record<string, string>,
    place: { salonId?: string; masterId?: string } = {},
  ) => ({ pathParams, salonId: place.salonId ?? null, masterId: place.masterId ?? null });

  it('names a Салон, a Майстер and a Клієнт of the address, each leading to its card', () => {
    expect(
      pathIdsOf(
        entry(
          { salonId: 's-1', masterId: 'm-1', clientId: 'c-1' },
          { salonId: 's-1', masterId: 'm-1' },
        ),
      ),
    ).toEqual([
      { param: 'salonId', kind: 'salon', id: 's-1', link: ['/salons', 's-1'] },
      // A Майстер салону reached by this address is sent on to his card inside the Салон.
      { param: 'masterId', kind: 'master', id: 'm-1', link: ['/independent-masters', 'm-1'] },
      { param: 'clientId', kind: 'client', id: 'c-1', link: ['/clients', 'c-1'] },
    ]);
  });

  it('leads a service to the catalogue of the Місце it belongs to', () => {
    expect(pathIdsOf(entry({ serviceId: 'svc-1' }, { salonId: 's-1' }))).toEqual([
      { param: 'serviceId', kind: 'service', id: 'svc-1', link: ['/salons', 's-1', 'services'] },
    ]);
    expect(
      pathIdsOf(
        entry({ masterId: 'm-1', serviceId: 'svc-1' }, { salonId: 's-1', masterId: 'm-1' }),
      )[1],
    ).toEqual({
      param: 'serviceId',
      kind: 'service',
      id: 'svc-1',
      link: ['/salons', 's-1', 'masters', 'm-1', 'services'],
    });
    expect(pathIdsOf(entry({ serviceId: 'svc-1' }, { masterId: 'm-1' }))).toEqual([
      {
        param: 'serviceId',
        kind: 'service',
        id: 'svc-1',
        link: ['/independent-masters', 'm-1', 'services'],
      },
    ]);
  });

  it('names a Запис, and a service of no known Місце, without leading anywhere — the panel has no screen for them', () => {
    expect(pathIdsOf(entry({ appointmentId: 'appt-1', serviceId: 'svc-1' }))).toEqual([
      { param: 'appointmentId', kind: 'appointment', id: 'appt-1', link: null },
      { param: 'serviceId', kind: 'service', id: 'svc-1', link: null },
    ]);
  });

  it('keeps an id it does not know as it is, by the name the address gave it', () => {
    expect(pathIdsOf(entry({ notificationId: 'n-1', type: 'avatar' }))).toEqual([
      { param: 'notificationId', kind: null, id: 'n-1', link: null },
      { param: 'type', kind: null, id: 'avatar', link: null },
    ]);
  });

  it('names nothing for an address without ids', () => {
    expect(pathIdsOf(entry({}))).toEqual([]);
  });
});

describe('auditRowLink', () => {
  const audit = (target: { type: string; id: string }, salonId: string | null, action: string) => ({
    kind: 'audit' as const,
    auditId: 'audit-1',
    target,
    salonId,
    action,
  });
  /** 00:30 on 22 September in Chișinău — still the 21st in UTC. */
  const AT = '2026-09-21T21:30:00.000Z';

  it('leads to the «Історія» of the card the row is about: a Салон, a Незалежний майстер, a Клієнт', () => {
    expect(auditRowLink(audit({ type: 'salon', id: 's-1' }, 's-1', 'salon.profile.update'), AT)).toEqual({
      to: 'history',
      path: ['/salons', 's-1', 'history'],
      queryParams: null,
    });
    expect(auditRowLink(audit({ type: 'master', id: 'm-1' }, null, 'master.block'), AT)).toEqual({
      to: 'history',
      path: ['/independent-masters', 'm-1', 'history'],
      queryParams: null,
    });
    expect(auditRowLink(audit({ type: 'client', id: 'c-1' }, null, 'client.block'), AT)).toEqual({
      to: 'history',
      path: ['/clients', 'c-1', 'history'],
      queryParams: null,
    });
  });

  it('leads to the row in the Журнал дій where the card has no «Історія» — a Майстер салону, the platform’s settings — by its day on the platform’s clock, target and action', () => {
    expect(
      auditRowLink(audit({ type: 'master', id: 'm-1' }, 's-1', 'salon.master.update'), AT),
    ).toEqual({
      to: 'audit-log',
      path: ['/audit-log'],
      // The row is written as the request is served: by the next day at the latest.
      queryParams: { from: '2026-09-22', to: '2026-09-23', targetType: 'master', action: 'salon.master.update' },
    });
    expect(
      auditRowLink(
        audit({ type: 'platform', id: 'settings' }, null, 'platform.ukrainian_phones.update'),
        AT,
      ),
    ).toEqual({
      to: 'audit-log',
      path: ['/audit-log'],
      queryParams: {
        from: '2026-09-22',
        to: '2026-09-23',
        targetType: 'platform',
        action: 'platform.ukrainian_phones.update',
      },
    });
  });
});
