import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/salon_images/s1/gallery/a.jpg';
const OTHER_PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/salon_images/s1/gallery/b.jpg';
const SCAN = 'https://res.cloudinary.com/demo/image/upload/v1/salon_images/s1/certificates/c.jpg';
const AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1/master_images/m1/avatar/a.jpg';

const certificate = (overrides: Record<string, unknown> = {}) => ({
  certificateId: 'cert-1',
  title: 'Диплом перукаря',
  issuer: 'Академія краси',
  issuedAt: '2024-05-01T00:00:00.000Z',
  expiresAt: null,
  credentialId: 'AB-1234',
  verificationUrl: 'https://verify.example.com/ab-1234',
  notes: null,
  fileUrl: SCAN,
  isActive: true,
  createdAt: '2024-05-02T00:00:00.000Z',
  updatedAt: '2024-05-02T00:00:00.000Z',
  ...overrides,
});

const salonMedia = (overrides: Record<string, unknown> = {}) => ({
  avatarUrl: null,
  images: [PHOTO, OTHER_PHOTO],
  certificates: [certificate()],
  ...overrides,
});

const salonCard = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: 'Hair and nails',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: 'Chișinău',
  addressZipCode: 'MD-2012',
  addressCountry: 'MD',
  locationLatitude: '47.0245',
  locationLongitude: '28.8323',
  phone: '+37360000001',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 4.8,
  reviewCount: 12,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: '#aa3366',
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

const masterCard = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
  description: 'Barber',
  addressStreet: 'Strada Mihai',
  addressHouseNumber: '4',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: 'Chișinău',
  addressZipCode: 'MD-2012',
  addressCountry: 'MD',
  locationLatitude: null,
  locationLongitude: null,
  phone: '+37360000002',
  email: 'ion@bookme.md',
  specialization: 'barber',
  timezone: 'Europe/Chisinau',
  rating: 4.6,
  reviewCount: 7,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  salon: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

test.describe('вкладка «Фото й сертифікати» Салону', () => {
  test('shows the gallery and the certificates, and warns that deleting is final', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
    });

    await signIn(page, ADMIN, '/salons/s1/media');

    await expect(page.getByTestId('media-photo')).toHaveCount(2);
    await expect(page.getByTestId('media-photo-image').first()).toHaveAttribute('src', PHOTO);
    // A Салон has no avatar of its own, so nothing about one is shown.
    await expect(page.getByTestId('media-avatar')).toHaveCount(0);
    await expect(page.getByTestId('media-certificate')).toHaveCount(1);
    await expect(page.getByTestId('media-certificate-title')).toHaveText('Диплом перукаря');
    await expect(page.getByTestId('media-certificate-scan')).toHaveAttribute('src', SCAN);
    await expect(page.getByTestId('media-certificate-dates')).toContainText('1 трав');
    await expect(page.getByTestId('media-irreversible')).toContainText('незворотне');
  });

  test('offers no way to add anything — content stays the owner’s business', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
    });

    await signIn(page, ADMIN, '/salons/s1/media');

    await expect(page.getByTestId('media-readonly')).toContainText('лише власник');
    await expect(page.getByRole('button', { name: /Додати|Завантажити/ })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test('destroys a photo with a reason and redraws from the answer', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
      'DELETE /admin/salons/s1/images': apiOk(salonMedia({ images: [OTHER_PHOTO] })),
    });
    await signIn(page, ADMIN, '/salons/s1/media');

    await page.getByTestId('media-photo-delete').first().click();
    await expect(page.getByTestId('reason-message')).toContainText('знищено');
    // The reason is mandatory: nothing is sent until there is one.
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await page.getByTestId('reason-input').fill('Чуже фото');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('media-photo')).toHaveCount(1);
    expect(mock.bodies['DELETE /admin/salons/s1/images']).toEqual([{ imageUrl: PHOTO, reason: 'Чуже фото' }]);
  });

  test('destroys a certificate together with its scan', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
      'DELETE /admin/salons/s1/certificates/cert-1': apiOk(salonMedia({ certificates: [] })),
    });
    await signIn(page, ADMIN, '/salons/s1/media');

    await page.getByTestId('media-certificate-delete').click();
    await expect(page.getByTestId('reason-message')).toContainText('Диплом перукаря');
    await page.getByTestId('reason-input').fill('Підроблений документ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('media-certificates-empty')).toBeVisible();
    expect(mock.bodies['DELETE /admin/salons/s1/certificates/cert-1']).toEqual([{ reason: 'Підроблений документ' }]);
  });

  test('keeps the dialog open with the reason as typed when the backend refuses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
      'DELETE /admin/salons/s1/images': apiError(409, 'EDIT_CONFLICT'),
    });
    await signIn(page, ADMIN, '/salons/s1/media');

    await page.getByTestId('media-photo-delete').first().click();
    await page.getByTestId('reason-input').fill('Чуже фото');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Чуже фото');
    await expect(page.getByText('Дані змінились. Перезавантажте форму й спробуйте ще раз.')).toBeVisible();
    await expect(page.getByTestId('media-photo')).toHaveCount(2);
  });

  /** The account is gone, the photos are not — and this tab is the only place left to see them. */
  test('still shows the content of a Видалений Салон', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard({ status: 'deleted', deletedAt: '2026-06-01T00:00:00.000Z' })),
      'GET /admin/salons/s1/media': apiOk(salonMedia()),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
    });

    await signIn(page, ADMIN, '/salons/s1/media');

    await expect(page.getByTestId('media-photo')).toHaveCount(2);
    await expect(page.getByTestId('media-certificate')).toHaveCount(1);
    // Readable, and no longer anyone's to change: the backend refuses every destroy over a
    // Видалений профіль, so the button that would only earn an error toast is not offered.
    await expect(page.getByTestId('media-readonly-profile')).toBeVisible();
    await expect(page.getByTestId('media-photo-delete')).toHaveCount(0);
    await expect(page.getByTestId('media-certificate-delete')).toHaveCount(0);
    await expect(page.getByTestId('media-irreversible')).toHaveCount(0);
  });

  test('says so when there is nothing to moderate', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/media': apiOk({ avatarUrl: null, images: [], certificates: [] }),
    });

    await signIn(page, ADMIN, '/salons/s1/media');

    await expect(page.getByTestId('media-gallery-empty')).toBeVisible();
    await expect(page.getByTestId('media-certificates-empty')).toBeVisible();
  });
});

test.describe('вкладка «Фото й сертифікати» Незалежного майстра', () => {
  test('shows the avatar and destroys it with a reason', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(masterCard()),
      'GET /admin/masters/m1/media': apiOk({ avatarUrl: AVATAR, images: [PHOTO], certificates: [] }),
      'DELETE /admin/masters/m1/avatar': apiOk({ avatarUrl: null, images: [PHOTO], certificates: [] }),
    });

    await signIn(page, ADMIN, '/independent-masters/m1/media');

    await expect(page.getByTestId('media-avatar-image')).toHaveAttribute('src', AVATAR);
    await page.getByTestId('media-avatar-delete').click();
    await page.getByTestId('reason-input').fill('Невідповідне зображення');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('media-avatar')).toHaveCount(0);
    // The gallery is untouched: one asset per decision.
    await expect(page.getByTestId('media-photo')).toHaveCount(1);
    expect(mock.bodies['DELETE /admin/masters/m1/avatar']).toEqual([{ reason: 'Невідповідне зображення' }]);
  });

  test('shows a certificate that has no scan as such', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(masterCard()),
      'GET /admin/masters/m1/media': apiOk({
        avatarUrl: null,
        images: [],
        certificates: [certificate({ fileUrl: '', expiresAt: '2027-05-01T00:00:00.000Z' })],
      }),
    });

    await signIn(page, ADMIN, '/independent-masters/m1/media');

    await expect(page.getByTestId('media-certificate-noscan')).toBeVisible();
    await expect(page.getByTestId('media-certificate-scan')).toHaveCount(0);
    await expect(page.getByTestId('media-certificate-dates')).toContainText('дійсний до');
  });
});
