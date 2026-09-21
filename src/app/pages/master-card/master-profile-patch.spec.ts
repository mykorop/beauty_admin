import type { Master } from '../../core/api/masters.client';
import {
  buildMasterProfilePatch,
  type MasterProfileFormValue,
  toMasterProfileFormValue,
} from './master-profile-patch';

const master = (overrides: Partial<Master> = {}): Master =>
  ({
    masterId: 'm1',
    name: 'Ion Popa',
    description: 'Barber',
    addressStreet: 'Strada Pușkin',
    addressHouseNumber: '22',
    addressCityCode: '0100000',
    addressCity: 'Chișinău',
    addressState: '',
    addressZipCode: 'MD-2012',
    addressCountry: 'MD',
    locationLatitude: '47.0245',
    locationLongitude: '28.8323',
    phone: '+37360000001',
    email: 'ion@bookme.md',
    specialization: 'barber',
    timezone: 'Europe/Chisinau',
    rating: 4.6,
    reviewCount: 7,
    bufferMinutes: 10,
    bookingForwardDays: 30,
    brandColor: '#aa3366',
    language: 'ro',
    status: 'active',
    deletedAt: null,
    blockedAt: null,
    blockedReason: null,
    shortLinks: { random: null, handle: null },
    salon: null,
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-05-02T11:30:00.000Z',
    ...overrides,
  }) as Master;

const formOf = (overrides: Partial<MasterProfileFormValue> = {}): MasterProfileFormValue => ({
  ...toMasterProfileFormValue(master()),
  ...overrides,
});

describe('master profile patch', () => {
  it('is empty while nothing has changed', () => {
    expect(buildMasterProfilePatch(master(), formOf())).toEqual({});
  });

  it('carries only the fields that differ', () => {
    const patch = buildMasterProfilePatch(master(), formOf({ name: 'Ion Popa Jr', bufferMinutes: 15 }));

    expect(patch).toEqual({ name: 'Ion Popa Jr', bufferMinutes: 15 });
  });

  it('treats a value typed over and put back as no change, trimming what was typed', () => {
    expect(buildMasterProfilePatch(master(), formOf({ name: '  Ion Popa  ' }))).toEqual({});
  });

  it('sends an emptied brand colour as null', () => {
    expect(buildMasterProfilePatch(master(), formOf({ brandColor: '' }))).toEqual({ brandColor: null });
  });

  it('keeps the stored number when the field was emptied rather than retyped', () => {
    expect(buildMasterProfilePatch(master(), formOf({ bufferMinutes: null }))).toEqual({});
  });

  it('sends a changed specialization', () => {
    expect(buildMasterProfilePatch(master(), formOf({ specialization: 'hair_specialist' }))).toEqual({
      specialization: 'hair_specialist',
    });
  });

  it('never carries a field the administrator may not edit', () => {
    const patch = buildMasterProfilePatch(master(), formOf({ name: 'New' }));

    for (const field of ['email', 'timezone', 'status', 'rating', 'salon', 'updatedAt']) {
      expect(patch).not.toEqual(jasmine.objectContaining({ [field]: jasmine.anything() }));
    }
  });
});
