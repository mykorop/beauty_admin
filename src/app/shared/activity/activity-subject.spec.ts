import { sentryLinks } from '../../core/monitoring/sentry-links';
import { activityLogLink, activitySubjectQuery, sentryErrorsLink } from './activity-subject';

describe('activitySubjectQuery', () => {
  it('asks for what an account did by its id, with no period — all the log keeps', () => {
    expect(activitySubjectQuery({ kind: 'account', id: 'client-sub-1' })).toEqual({
      actorId: 'client-sub-1',
    });
  });

  it('asks for all that happened in a Місце by its id', () => {
    expect(activitySubjectQuery({ kind: 'place', id: 's1' })).toEqual({ placeId: 's1' });
  });
});

describe('activityLogLink', () => {
  it('opens the «Журнал активності» on the account', () => {
    expect(activityLogLink({ kind: 'account', id: 'm1' })).toEqual({
      path: ['/activity-log'],
      queryParams: { account: 'm1' },
    });
  });

  it('opens the «Журнал активності» on the Місце', () => {
    expect(activityLogLink({ kind: 'place', id: 's1' })).toEqual({
      path: ['/activity-log'],
      queryParams: { place: 's1' },
    });
  });
});

describe('sentryErrorsLink', () => {
  const links = sentryLinks('https://bookme.sentry.io');
  const errorsOf = (userId: string) =>
    `https://bookme.sentry.io/issues/?project=-1&statsPeriod=90d&query=user.id%3A${userId}`;

  it('finds the errors of the account a card is of — a Майстер’s, a Клієнт’s', () => {
    expect(
      sentryErrorsLink({ subjects: [{ kind: 'account', id: 'c1' }], owner: null }, links),
    ).toEqual({
      href: errorsOf('c1'),
      labelKey: 'activityTab.sentryErrors',
    });
  });

  it('takes the account, not the Місце, of a Незалежний майстер, whichever is shown first', () => {
    const subjects = [
      { kind: 'place', id: 'm1' },
      { kind: 'account', id: 'm1' },
    ] as const;
    expect(sentryErrorsLink({ subjects, owner: null }, links)?.href).toBe(errorsOf('m1'));
  });

  it('finds the errors of a Салон’s Власник, worded as his', () => {
    expect(
      sentryErrorsLink({ subjects: [{ kind: 'place', id: 's1' }], owner: 'owner-1' }, links),
    ).toEqual({ href: errorsOf('owner-1'), labelKey: 'activityTab.ownerSentryErrors' });
  });

  it('leads nowhere for a Салон whose Власник is not named', () => {
    expect(
      sentryErrorsLink({ subjects: [{ kind: 'place', id: 's1' }], owner: null }, links),
    ).toBeNull();
  });

  it('leads nowhere in a build that names no Sentry organisation', () => {
    expect(
      sentryErrorsLink({ subjects: [{ kind: 'account', id: 'c1' }], owner: null }, null),
    ).toBeNull();
  });
});
