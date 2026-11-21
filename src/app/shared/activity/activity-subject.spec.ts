import { activityLogLink, activitySubjectQuery } from './activity-subject';

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
