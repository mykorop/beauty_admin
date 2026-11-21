import { actorCardLink, placeCardLink } from './activity-links';

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
