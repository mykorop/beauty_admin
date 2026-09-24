import type { Page, TestInfo } from '@playwright/test';
import { apiError, apiOk, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const NOW = '2026-09-23T09:00:00Z';
const NAME = 'Олександра Константинопольська — îngrijire și înfrumusețare';
const salon = {
  salonId: 's1',
  name: 'Atelier de frumusețe — îngrijire și înfrumusețare',
  ownerName: NAME,
  timezone: 'Europe/Chisinau',
  status: 'active',
  email: 'atelier@example.test',
  phone: '+37360000001',
  language: 'ro',
  shortLinks: { random: null, handle: null },
  createdAt: NOW,
  updatedAt: NOW,
};
const master = { ...salon, masterId: 'm1', name: NAME, salon: null };
const roster = { masterId: 'm2', masterName: NAME, isOwner: false, status: 'ACTIVE' };
const client = {
  ...salon,
  clientId: 'c1',
  name: NAME,
  firstName: 'Олександра',
  lastName: 'Константинопольська',
};
const week = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0,
  slots: dayOfWeek === 0 ? [] : [{ start: '09:00', end: '18:00' }],
}));
const schedule = {
  weeklyHours: week,
  todayDate: '2026-09-23',
  timezone: salon.timezone,
  schedulePattern: { anchorDate: '2026-09-01', cycleLength: 4, workingOffsets: [0, 1, 2] },
  timeOff: [
    {
      groupId: 'g1',
      type: 'DAY_OFF',
      fromDate: '2026-09-24',
      toDate: '2026-09-24',
      slots: [],
      reason: NAME,
    },
    {
      groupId: 'g2',
      type: 'CUSTOM_HOURS',
      fromDate: '2026-09-25',
      toDate: '2026-09-25',
      slots: [{ start: '12:00', end: '15:00' }],
      reason: 'Особливі години / Program special',
    },
    {
      groupId: 'g3',
      type: 'BLOCKED',
      fromDate: '2026-09-28',
      toDate: '2026-09-28',
      slots: [],
      reason: 'Заблокований проміжок / Interval blocat',
    },
  ],
  appointments: [
    {
      appointmentId: 'a1',
      startTime: '2026-09-23T10:00:00Z',
      endTime: '2026-09-23T11:00:00Z',
      status: 'BOOKED',
    },
    {
      appointmentId: 'a2',
      startTime: '2026-09-23T12:00:00Z',
      endTime: '2026-09-23T13:00:00Z',
      status: 'CANCELLED',
    },
  ],
};
const routes: MockRoutes = {
  'GET /admin/me': apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email }),
  'GET /admin/salons/s1': apiOk(salon),
  'GET /admin/masters/m1': apiOk(master),
  'GET /admin/clients/c1': apiOk(client),
  'GET /admin/salons/s1/masters/m2': apiOk(roster),
  'GET /admin/salons/s1/hours': apiOk({
    days: week.map((day) => (day.dayOfWeek === 6 ? { ...day, isOpen: false, slots: [] } : day)),
  }),
  'GET /admin/salons/s1/masters/m2/schedule': apiOk(schedule),
  'GET /admin/masters/m1/schedule': apiOk(schedule),
  'PUT /admin/salons/s1/masters/m2/hours': apiError(
    400,
    'MASTER_HOURS_OUTSIDE_SALON_HOURS',
    'Outside salon hours',
    {
      dayOfWeek: 1,
      outsideSlot: { start: '08:00', end: '18:00' },
      salonSlots: [{ start: '09:00', end: '18:00' }],
    },
  ),
};

const appointment = {
  appointmentId: 'a1',
  startTime: '2026-09-24T06:00:00Z',
  endTime: '2026-09-24T06:45:00Z',
  status: 'BOOKED',
  clientId: 'c1',
  clientName: NAME,
  masterId: 'm2',
  masterName: NAME,
  salonId: 's1',
  venueName: salon.name,
  timezone: salon.timezone,
  serviceNames: ['Відновлення та професійний догляд за волоссям'],
  totalPrice: 1250.5,
  currency: 'MDL',
  isManual: true,
};
const details = {
  ...appointment,
  updatedAt: NOW,
  clientPhone: salon.phone,
  salonName: salon.name,
  venueStatus: 'active',
  services: [
    { serviceId: 'svc1', name: appointment.serviceNames[0], durationMinutes: 45, price: 1250.5 },
  ],
  totalDurationMinutes: 45,
  notes: 'За узгодженням із Клієнтом / Conform solicitării clientului',
};
const items = [
  appointment,
  ...['COMPLETED', 'CANCELLED', 'NO_SHOW', 'BOOKED'].map((status, index) => ({
    ...appointment,
    appointmentId: `a${index + 2}`,
    status,
    isManual: false,
    startTime: '2026-09-22T06:00:00Z',
    endTime: '2026-09-22T06:45:00Z',
  })),
];
const appointmentRoutes: MockRoutes = {
  ...routes,
  'GET /admin/salons': apiOk({ items: [salon], builtAt: NOW }),
  'GET /admin/masters': apiOk({ items: [master], builtAt: NOW }),
  'GET /admin/clients': apiOk({ items: [client], builtAt: NOW }),
  'GET /admin/salons/s1/masters': apiOk({ items: [roster] }),
  'GET /admin/appointments': apiOk({ items }),
  'GET /admin/appointments/day': apiOk({
    run: null,
    result: {
      runId: 'r1',
      date: '2026-09-24',
      builtAt: NOW,
      timeZone: salon.timezone,
      scannedItems: 5,
      items,
    },
  }),
  'GET /admin/salons/s1/appointments': apiOk({ items, timezone: salon.timezone }),
  'GET /admin/masters/m1/appointments': apiOk({ items, timezone: salon.timezone }),
  'GET /admin/salons/s1/masters/m2/appointments': apiOk({ items, timezone: salon.timezone }),
  'GET /admin/clients/c1/appointments': apiOk({ items, nextCursor: null }),
  'GET /admin/appointments/a1': apiOk(details),
  'GET /admin/appointments/a1/available-slots': apiOk({
    timezone: salon.timezone,
    slotOptions: [
      {
        date: '2026-09-24',
        localTime: '09:00',
        startAtUtc: appointment.startTime,
        utcOffset: '+03:00',
        status: 'available',
      },
      {
        date: '2026-09-24',
        localTime: '10:00',
        startAtUtc: '2026-09-24T07:00:00Z',
        utcOffset: '+03:00',
        status: 'booked',
      },
      {
        date: '2026-09-24',
        localTime: '11:00',
        startAtUtc: '2026-09-24T08:00:00Z',
        utcOffset: '+03:00',
        status: 'too_short',
      },
      {
        date: '2026-09-24',
        localTime: '14:00',
        startAtUtc: '2026-09-24T11:00:00Z',
        utcOffset: '+03:00',
        status: 'available',
      },
    ],
  }),
  'PATCH /admin/appointments/a1/reschedule': apiError(409, 'SLOT_UNAVAILABLE'),
};

async function fits(page: Page) {
  for (const note of await page.getByTestId('appointment-row-stale').all()) {
    expect(await note.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
}
async function capture(page: Page, info: TestInfo, name: string, modal = false) {
  await page.evaluate(() => document.fonts.ready);
  const target =
    name === 'calendar'
      ? page.getByTestId('schedule-calendar')
      : name === 'rotation'
        ? page.getByTestId('rotation-form')
        : null;
  if (target) {
    await target.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' });
  } else {
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: !modal,
      animations: 'disabled',
    });
  }
}

test.use({ timezoneId: 'Europe/Chisinau', reducedMotion: 'reduce', colorScheme: 'light' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
});

const samples = [
  { width: 1440, height: 1000, language: 'uk' },
  { width: 1024, height: 900, language: 'ro' },
  { width: 768, height: 1000, language: 'ru' },
  { width: 390, height: 844, language: 'ro' },
  { width: 720, height: 500, language: 'uk' },
];
for (const sample of samples) {
  test.describe(`${sample.width}px ${sample.language}`, () => {
    test.use({ viewport: { width: sample.width, height: sample.height } });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (language) => localStorage.setItem('bookme.admin.language', language),
        sample.language,
      );
    });
    test('schedule, hours and rotation stay readable with local calendar scrolling', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, routes);
      await signIn(page, ADMIN, '/salons/s1/masters/m2/schedule');
      const today = page
        .getByTestId('calendar-day')
        .filter({ has: page.getByTestId('calendar-today') });
      await expect(today).toHaveCSS('background-color', 'rgb(30, 32, 36)');
      await expect(today.getByTestId('calendar-appointments')).toHaveText('1');
      await expect(today.getByTestId('calendar-cancelled')).toContainText('1');
      await fits(page);
      if (sample.width === 1440) await capture(page, info, 'calendar');
      await page.getByTestId('hours-edit').click();
      await fits(page);
      const first = page.getByTestId('hours-edit-day').first();
      await first.getByTestId('hours-start').fill('');
      await expect(page.getByTestId('hours-save')).toBeDisabled();
      if (sample.width === 390) await capture(page, info, 'hours-invalid');
      await first.getByTestId('hours-start').fill('08:00');
      await expect(first.getByTestId('hours-outside')).toBeVisible();
      if (sample.width === 390) await capture(page, info, 'hours');
      await page.getByTestId('hours-save').click();
      await expect(page.getByTestId('hours-refusal')).toBeVisible();
      await fits(page);
      if (sample.width === 390) await capture(page, info, 'hours-refusal');
      await page.getByTestId('hours-cancel').click();
      await page.getByTestId('rotation-edit').click();
      await expect(page.getByTestId('rotation-form')).toBeVisible();
      await fits(page);
      if (sample.width === 1024) await capture(page, info, 'rotation');
      await page.getByTestId('rotation-cancel').click();
      await page.getByTestId('time-off-add').click();
      await page.getByTestId('time-off-type-CUSTOM_HOURS').check();
      await fits(page);
      if (sample.width === 768) await capture(page, info, 'time-off');
      await page.goto('/salons/s1/hours');
      await expect(page.getByTestId('hours-day')).toHaveCount(7);
      await fits(page);
      await page.getByTestId('hours-edit').click();
      await fits(page);
      await page.goto('/independent-masters/m1/schedule');
      await expect(page.getByTestId('calendar-today')).toBeVisible();
      await fits(page);
    });
    test('appointment lists and rescheduling keep their theme, viewport and keyboard focus', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, appointmentRoutes);
      await signIn(page, ADMIN, '/appointments?date=2026-09-24');
      await expect(page.getByTestId('appointment-row')).toHaveCount(5);
      await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
      await fits(page);
      await page.getByTestId('appointments-filter-status').click();
      await expect(page.getByRole('listbox')).toHaveCSS('color', 'rgb(245, 242, 235)');
      if (sample.width === 1440) await capture(page, info, 'appointments');
      await page.keyboard.press('Escape');
      await page.getByTestId('appointment-row-toggle').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('appointment-details-total')).toContainText('MDL');
      if (sample.width === 1440) await capture(page, info, 'appointment-details');
      const trigger = page.getByTestId('appointment-action-reschedule');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('reschedule-day')).toBeFocused();
      await fits(page);
      const dialog = page.getByRole('dialog');
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(sample.width);
      await page.getByTestId('reschedule-slot').filter({ hasText: '14:00' }).click();
      await page
        .getByTestId('reschedule-reason')
        .fill('Сторони домовились — la solicitarea clientului');
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      }
      if ([390, 720].includes(sample.width)) await capture(page, info, 'reschedule', true);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      for (const path of [
        '/salons/s1/appointments',
        '/salons/s1/masters/m2/appointments',
        '/independent-masters/m1/appointments',
        '/clients/c1/appointments',
      ]) {
        await page.goto(path);
        await expect(page.getByTestId('appointment-row')).toHaveCount(5);
        await fits(page);
        await page.getByTestId('appointment-row-toggle').first().click();
        await expect(page.getByTestId('appointment-details-total')).toContainText('MDL');
        await fits(page);
      }
    });
  });
}

test.describe('narrow dialogs', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('rescheduling keeps focus and the chosen slot while busy and after a refusal', async ({
    page,
    mockBackend,
  }, info) => {
    await mockBackend(ADMIN, appointmentRoutes);
    await signIn(page, ADMIN, '/salons/s1/appointments');
    await page.getByTestId('appointment-row-toggle').first().click();
    await page.getByTestId('appointment-action-reschedule').click();
    await page.getByTestId('reschedule-slot').filter({ hasText: '14:00' }).click();
    await page.getByTestId('reschedule-reason').fill('Сторони домовились');
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/admin/appointments/a1/reschedule', async (route) => {
      await held;
      await route.fallback();
    });
    await page.getByTestId('reschedule-confirm').click();
    await expect(page.getByTestId('reschedule-confirm')).toBeDisabled();
    await expect(page.getByTestId('reschedule-cancel')).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.locator('.p-dialog-mask').click({ position: { x: 2, y: 2 } });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Tab');
    expect(
      await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
    await capture(page, info, 'reschedule-busy', true);
    release();
    await expect(page.getByText('Цей слот уже зайнятий. Оберіть інший.')).toBeVisible();
    await expect(page.getByTestId('reschedule-reason')).toHaveValue('Сторони домовились');
    await expect(page.getByTestId('reschedule-slot').filter({ hasText: '14:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('reschedule-confirm')).toBeEnabled();
    await fits(page);
    await capture(page, info, 'reschedule-refusal', true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('appointment-action-reschedule')).toBeFocused();
  });

  test('bulk cancellation keeps profile context, required reason and partial result readable', async ({
    page,
    mockBackend,
  }, info) => {
    await mockBackend(ADMIN, {
      ...appointmentRoutes,
      'GET /admin/salons/s1': apiOk({
        ...salon,
        status: 'blocked',
        blockedReason: 'За зверненням власника',
        blockedAt: NOW,
      }),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 12 }),
      'POST /admin/salons/s1/appointments/cancel-upcoming': apiOk({
        cancelled: 10,
        failed: 2,
        remaining: 2,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/appointments');
    await page.getByTestId('upcoming-cancel-open').click();
    await expect(page.getByTestId('reason-message')).toContainText(salon.name);
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await expect(page.getByTestId('reason-input')).toBeFocused();
    await page.getByTestId('reason-input').fill('За зверненням власника Салону');
    await fits(page);
    await capture(page, info, 'bulk-cancel', true);
    await page.getByTestId('reason-confirm').click();
    await expect(page.getByTestId('upcoming-cancel-open')).toBeFocused();
    await expect(page.getByTestId('card-upcoming-count')).toContainText('2');
    await expect(page.locator('.p-toast-message')).toBeVisible();
    await fits(page);
    await capture(page, info, 'bulk-result');
  });
});

test('today remains legible in the next month and the calendar scrolls by keyboard', async ({
  page,
  mockBackend,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-09-30T09:00:00Z'));
  await mockBackend(ADMIN, {
    ...routes,
    'GET /admin/masters/m1/schedule': apiOk({ ...schedule, todayDate: '2026-09-30' }),
  });
  await signIn(page, ADMIN, '/independent-masters/m1/schedule');
  await page.getByTestId('calendar-next').click();
  await expect(page.getByTestId('calendar-month')).toContainText('жовтень');
  await expect(page.getByTestId('calendar-day').first()).toHaveAttribute('data-date', '2026-09-28');
  await expect(page.getByTestId('calendar-today')).toHaveCSS('color', 'rgb(24, 26, 29)');
  const calendar = page.getByTestId('schedule-calendar').getByRole('region');
  await page.keyboard.press('Tab');
  await calendar.focus();
  await expect(calendar).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => calendar.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
});
