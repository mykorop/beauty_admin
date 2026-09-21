import type { Salon } from '../../core/api/salons.client';
import { buildSalonProfilePatch, toSalonProfileFormValue } from './salon-profile-patch';

const SALON = {
  name: 'Beauty Lab',
  description: 'Hair and nails',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressZipCode: 'MD-2012',
  phone: '+37360000001',
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: '#aa3366',
} as Salon;

describe('buildSalonProfilePatch', () => {
  const form = toSalonProfileFormValue(SALON);

  it('is empty for an untouched form', () => {
    expect(buildSalonProfilePatch(SALON, form)).toEqual({});
  });

  it('holds only the fields that changed', () => {
    expect(buildSalonProfilePatch(SALON, { ...form, name: 'New', bufferMinutes: 0 })).toEqual({
      name: 'New',
      bufferMinutes: 0,
    });
  });

  it('does not count surrounding spaces as a change', () => {
    expect(buildSalonProfilePatch(SALON, { ...form, name: '  Beauty Lab ' })).toEqual({});
  });

  it('sends an emptied brand colour as null, and none → none as no change', () => {
    expect(buildSalonProfilePatch(SALON, { ...form, brandColor: ' ' })).toEqual({ brandColor: null });

    const colourless = { ...SALON, brandColor: null };
    expect(buildSalonProfilePatch(colourless, toSalonProfileFormValue(colourless))).toEqual({});
  });

  it('leaves an emptied number out rather than sending null', () => {
    expect(buildSalonProfilePatch(SALON, { ...form, bufferMinutes: null })).toEqual({});
  });
});
