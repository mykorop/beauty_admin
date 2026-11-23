import { failedFieldsOf } from './activity-error';

describe('failedFieldsOf', () => {
  it('names every field a failed check refused, part by part, with its messages', () => {
    expect(
      failedFieldsOf({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          body: { startTime: ['Invalid time', 'Required'], 'services.0.serviceId': ['Required'] },
          pathParameters: { appointmentId: ['Invalid uuid'] },
        },
      }),
    ).toEqual([
      { field: 'body · startTime', messages: 'Invalid time; Required' },
      { field: 'body · services.0.serviceId', messages: 'Required' },
      { field: 'pathParameters · appointmentId', messages: 'Invalid uuid' },
    ]);
  });

  it('names the part alone when the part as a whole was refused', () => {
    expect(
      failedFieldsOf({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { query: { _root: ['Expected object'] } },
      }),
    ).toEqual([{ field: 'query', messages: 'Expected object' }]);
  });

  it('has nothing to name for a success, or a refusal that was not a failed check', () => {
    expect(failedFieldsOf(null)).toBeNull();
    expect(
      failedFieldsOf({ code: 'CONFLICT', message: 'Taken', details: { body: { startTime: ['Taken'] } } }),
    ).toBeNull();
  });

  it('leaves details of another shape to be shown as they came', () => {
    const refusal = (details: unknown) => ({ code: 'VALIDATION_ERROR', message: 'Validation failed', details });
    expect(failedFieldsOf(refusal(undefined))).toBeNull();
    expect(failedFieldsOf(refusal('startTime is invalid'))).toBeNull();
    expect(failedFieldsOf(refusal([{ path: 'startTime' }]))).toBeNull();
    expect(failedFieldsOf(refusal({ body: ['Invalid'] }))).toBeNull();
    expect(failedFieldsOf(refusal({ body: { startTime: 'Invalid' } }))).toBeNull();
    expect(failedFieldsOf(refusal({}))).toBeNull();
  });
});
