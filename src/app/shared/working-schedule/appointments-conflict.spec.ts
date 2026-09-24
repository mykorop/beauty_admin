import { ApiError } from '../../core/api/api-error';
import { appointmentsConflict } from './appointments-conflict';

const appointment = (appointmentId: string) => ({
  appointmentId,
  masterId: 'm2',
  startAtUtc: '2026-10-13T13:00:00.000Z',
  durationMinutes: 60,
  clientName: 'Irina',
  serviceNames: ['Manicure'],
  serviceIds: ['svc-1'],
});

describe('appointmentsConflict', () => {
  it('reads the days and the number of Записи standing inside a Відсутність', () => {
    const error = new ApiError('TIME_OFF_HAS_APPOINTMENTS', 'x', 409, {
      dates: ['2026-10-13'],
      appointmentCount: 2,
      appointments: [],
    });

    expect(appointmentsConflict(error)).toEqual({ dates: ['2026-10-13'], appointmentCount: 2 });
  });

  it('reads Записи a new week, Ротація or Години роботи would leave standing the same way', () => {
    const error = new ApiError('SCHEDULE_CHANGE_HAS_APPOINTMENTS', 'x', 409, {
      dates: ['2026-10-13', '2026-10-15'],
      appointmentCount: 3,
      appointments: [appointment('a1'), appointment('a2'), appointment('a3')],
    });

    expect(appointmentsConflict(error)).toEqual({
      dates: ['2026-10-13', '2026-10-15'],
      appointmentCount: 3,
    });
  });

  it('counts every Запис in the way, not only the ones the capped list carries', () => {
    const error = new ApiError('SCHEDULE_CHANGE_HAS_APPOINTMENTS', 'x', 409, {
      dates: ['2026-10-13'],
      appointmentCount: 64,
      appointments: Array.from({ length: 50 }, (_, index) => appointment(`a${index}`)),
    });

    expect(appointmentsConflict(error)?.appointmentCount).toBe(64);
  });

  it('is nothing for any other refusal', () => {
    expect(
      appointmentsConflict(new ApiError('ROSTER_HOURS_OUTSIDE_SALON_HOURS', 'x', 409)),
    ).toBeNull();
    expect(appointmentsConflict(new ApiError('SALON_DELETED', 'x', 409))).toBeNull();
    expect(appointmentsConflict(new Error('x'))).toBeNull();
    expect(appointmentsConflict(null)).toBeNull();
  });
});
