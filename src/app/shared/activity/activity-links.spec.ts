import { actorCardLink, pathIdsOf, placeCardLink } from './activity-links';

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
