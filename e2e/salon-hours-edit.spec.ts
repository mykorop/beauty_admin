import type { Page } from '@playwright/test';
import { apiError, apiOk, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const PUT = 'PUT /admin/salons/s1/hours';

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: '',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
  locationLatitude: null,
  locationLongitude: null,
  phone: '+37360000001',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 0,
  reviewCount: 0,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const open = (dayOfWeek: number, start = '09:00', end = '18:00') => ({
  dayOfWeek,
  isOpen: true,
  slots: [{ start, end }],
});
const closed = (dayOfWeek: number) => ({ dayOfWeek, isOpen: false, slots: [] });
const LUNCH_BREAK = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '19:00' },
];

/** Monday one window, Tuesday with a lunch break, Sunday closed, the rest never set. */
const STORED = { days: [closed(0), open(1), { dayOfWeek: 2, isOpen: true, slots: LUNCH_BREAK }] };

const routes = (put: MockRoutes[string]) => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon()),
  'GET /admin/salons/s1/hours': apiOk(STORED),
  [PUT]: put,
});

/** Rows are Monday first: row 0 is Monday, row 6 Sunday. */
const row = (page: Page, index: number) => page.getByTestId('hours-edit-day').nth(index);

test.describe('salon hours editing', () => {
  test('sends the whole week: edited days as one window, untouched days as stored', async ({ page, mockBackend }) => {
    const saved = { days: [closed(0), open(1, '10:00', '20:00'), STORED.days[2], open(3), closed(4), closed(5), closed(6)] };
    const mock = await mockBackend(ADMIN, routes(apiOk(saved)));
    await signIn(page, ADMIN, '/salons/s1/hours');

    await page.getByTestId('hours-edit').click();
    await expect(page.getByTestId('hours-edit-day')).toHaveCount(7);
    // Nothing changed yet — nothing to save.
    await expect(page.getByTestId('hours-save')).toBeDisabled();

    await row(page, 0).getByTestId('hours-start').fill('10:00');
    await row(page, 0).getByTestId('hours-end').fill('20:00');
    // Wednesday was never set: opening it offers the usual window.
    await row(page, 2).getByTestId('hours-open').check();
    await page.getByTestId('hours-reason').fill('Owner asked by phone');
    await page.getByTestId('hours-save').click();

    const days = page.getByTestId('hours-day');
    await expect(days.nth(0)).toContainText('10:00 – 20:00');
    await expect(days.nth(2)).toContainText('09:00 – 18:00');
    expect(mock.bodies[PUT]).toEqual([
      {
        salonHours: [
          closed(0),
          open(1, '10:00', '20:00'),
          // The lunch break nobody touched survives the one-window editor.
          { dayOfWeek: 2, isOpen: true, slots: LUNCH_BREAK },
          open(3),
          closed(4),
          closed(5),
          closed(6),
        ],
        reason: 'Owner asked by phone',
      },
    ]);
  });

  test('closing a day sends it closed and empties its window', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, routes(apiOk({ days: [closed(0), open(1), closed(2), closed(3), closed(4), closed(5), closed(6)] })));
    await signIn(page, ADMIN, '/salons/s1/hours');

    await page.getByTestId('hours-edit').click();
    await row(page, 1).getByTestId('hours-open').uncheck();
    await expect(row(page, 1).getByTestId('hours-start')).toBeHidden();
    await page.getByTestId('hours-save').click();

    await expect(page.getByTestId('hours-day').nth(1)).toContainText('Зачинено');
    expect((mock.bodies[PUT][0] as { salonHours: unknown[] }).salonHours[2]).toEqual(closed(2));
  });

  test('words a refused week by the domain rule it broke, and keeps the form as typed', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes(
        apiError(422, 'VALIDATION_ERROR', 'Validation failed', {
          body: {
            salonHours: ['the week must have at least one open day'],
            'salonHours.1.slots.0.end': ['slot must cover at least one hour'],
          },
        }),
      ),
    );
    await signIn(page, ADMIN, '/salons/s1/hours');

    await page.getByTestId('hours-edit').click();
    await row(page, 0).getByTestId('hours-end').fill('09:30');
    await page.getByTestId('hours-save').click();

    const refusals = page.getByTestId('hours-refusal');
    await expect(refusals).toHaveText([
      'У тижні має бути хоча б один відкритий день.',
      'Понеділок: вікно має тривати щонайменше 60 хвилин.',
    ]);
    await expect(row(page, 0).getByTestId('hours-end')).toHaveValue('09:30');
    // Worded in the form, not also as a toast.
    await expect(page.locator('.p-toast-message')).toHaveCount(0);
  });

  test('names the master whose Робочий графік falls outside the new week', async ({ page, mockBackend }) => {
    await mockBackend(
      ADMIN,
      routes(
        apiError(409, 'ROSTER_HOURS_OUTSIDE_SALON_HOURS', 'A roster master works outside the new salon hours', {
          masters: [{ masterId: 'm1', masterName: 'Ion Ceban', dayOfWeek: 4 }],
        }),
      ),
    );
    await signIn(page, ADMIN, '/salons/s1/hours');

    await page.getByTestId('hours-edit').click();
    await row(page, 0).getByTestId('hours-end').fill('17:00');
    await page.getByTestId('hours-save').click();

    await expect(page.getByTestId('hours-refusal')).toHaveText([
      'Робочий графік Майстра Ion Ceban виходить за нові Години роботи (четвер). Спершу змініть його графік.',
    ]);
  });

  test('names the Записи of the whole Ростер the new week leaves standing, and saves it over them once confirmed', async ({
    page,
    mockBackend,
  }) => {
    const week = [
      closed(0),
      open(1, '09:00', '14:00'),
      STORED.days[2],
      closed(3),
      closed(4),
      closed(5),
      closed(6),
    ];
    const booked = (appointmentId: string, masterId: string, startAtUtc: string) => ({
      appointmentId,
      masterId,
      startAtUtc,
      durationMinutes: 60,
      clientName: 'Irina',
      serviceNames: ['Manicure'],
      serviceIds: ['svc1'],
    });
    const mock = await mockBackend(
      ADMIN,
      routes((_url, body) =>
        (body as { allowExistingAppointments?: boolean }).allowExistingAppointments
          ? apiOk({ days: week })
          : apiError(409, 'SCHEDULE_CHANGE_HAS_APPOINTMENTS', 'Booked appointments no longer fit', {
              dates: ['2026-10-12', '2026-10-19'],
              appointmentCount: 3,
              // Two masters of the Ростер: the panel names how many and when, not whose.
              appointments: [
                booked('a1', 'm1', '2026-10-12T13:00:00.000Z'),
                booked('a2', 'm2', '2026-10-12T14:00:00.000Z'),
                booked('a3', 'm1', '2026-10-19T13:00:00.000Z'),
              ],
            }),
      ),
    );
    await signIn(page, ADMIN, '/salons/s1/hours');

    await page.getByTestId('hours-edit').click();
    await row(page, 0).getByTestId('hours-end').fill('14:00');
    await page.getByTestId('hours-save').click();

    // Nothing is saved and nothing is cancelled: the week stays as typed, and the Записи are named.
    const conflict = page.getByTestId('hours-conflict');
    await expect(conflict).toContainText('поза робочим часом: 3 (12 жовт. 2026');
    await expect(conflict).toContainText('19 жовт. 2026');
    await expect(page.getByTestId('hours-confirm')).toHaveText('Все одно зберегти');
    await expect(page.getByTestId('hours-refusal')).toHaveCount(0);
    await expect(page.locator('.p-toast-message')).toHaveCount(0);
    await expect(row(page, 0).getByTestId('hours-end')).toHaveValue('14:00');

    // The same conflict in another language.
    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();
    await expect(conflict).toContainText('în afara orelor de lucru: 3');
    await page.getByTestId('hours-confirm').click();

    await expect(page.getByTestId('hours-form')).toHaveCount(0);
    await expect(page.getByTestId('hours-day').nth(0)).toContainText('09:00 – 14:00');
    await expect(page.locator('.p-toast-message')).toContainText('Programul de lucru a fost salvat.');
    expect(mock.bodies[PUT]).toEqual([
      { salonHours: week },
      { salonHours: week, allowExistingAppointments: true },
    ]);
  });

  test('offers no editing on a Deleted salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
      // Not active, so the card asks how many Записи are still ahead of it (§12).
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/salons/s1/hours': apiOk(STORED),
    });
    await signIn(page, ADMIN, '/salons/s1/hours');

    await expect(page.getByTestId('hours-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);
  });

  test('words a change of hours in the «Історія» by day, not as raw rows', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/audit': apiOk({
        items: [
          {
            auditId: 'a1',
            adminId: 'e2e-user-sub',
            adminEmail: ADMIN.email,
            targetType: 'salon',
            targetId: 's1',
            salonId: 's1',
            action: 'salon.hours.update',
            createdAt: '2026-09-21T10:00:00.000Z',
            changes: [
              { field: 'hours.1.slots', before: [{ start: '09:00', end: '18:00' }], after: LUNCH_BREAK },
              { field: 'hours.3', before: null, after: closed(3) },
            ],
            reason: null,
            affected: [],
          },
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    await expect(page.getByTestId('history-entry')).toContainText('Зміна Годин роботи');
    const changes = page.getByTestId('history-change');
    await expect(changes.nth(0)).toContainText('Години роботи · понеділок · вікна');
    await expect(changes.nth(0)).toContainText('09:00 – 18:00');
    await expect(changes.nth(0)).toContainText('14:00 – 19:00');
    await expect(changes.nth(1)).toContainText('Години роботи · середа');
    await expect(changes.nth(1)).toContainText('Зачинено');
  });
});
