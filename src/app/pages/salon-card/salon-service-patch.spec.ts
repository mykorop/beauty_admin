import type { SalonService } from '../../core/api/salon-services.client';
import {
  buildSalonServicePatch,
  EMPTY_SALON_SERVICE_FORM_VALUE,
  touchesMasterOwnedFields,
  toSalonServiceFields,
  toSalonServiceFormValue,
} from './salon-service-patch';

const SERVICE: SalonService = {
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  masterCopyCount: 2,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('buildSalonServicePatch', () => {
  it('is empty for an untouched form', () => {
    expect(buildSalonServicePatch(SERVICE, toSalonServiceFormValue(SERVICE))).toEqual({});
  });

  it('carries only what changed, with the name trimmed', () => {
    const value = { ...toSalonServiceFormValue(SERVICE), name: '  Classic haircut ', price: 600 };

    expect(buildSalonServicePatch(SERVICE, value)).toEqual({ name: 'Classic haircut', price: 600 });
  });

  it('treats an emptied number as untouched — the form refuses to save it anyway', () => {
    const value = { ...toSalonServiceFormValue(SERVICE), durationMinutes: null };

    expect(buildSalonServicePatch(SERVICE, value)).toEqual({});
  });

  it('lets the description be cleared', () => {
    const value = { ...toSalonServiceFormValue(SERVICE), description: '' };

    expect(buildSalonServicePatch(SERVICE, value)).toEqual({ description: '' });
  });
});

describe('touchesMasterOwnedFields', () => {
  it('is true for a changed price or duration — the Копії майстрів will not follow', () => {
    expect(touchesMasterOwnedFields({ price: 600 })).toBeTrue();
    expect(touchesMasterOwnedFields({ durationMinutes: 40 })).toBeTrue();
  });

  it('is false for anything else', () => {
    expect(touchesMasterOwnedFields({ name: 'New', category: 'styling', isActive: false })).toBeFalse();
    expect(touchesMasterOwnedFields({})).toBeFalse();
  });
});

describe('toSalonServiceFields', () => {
  it('turns a filled new-service form into the body of the POST', () => {
    const value = {
      ...EMPTY_SALON_SERVICE_FORM_VALUE,
      name: ' Beard trim ',
      category: 'beard_and_mustache',
      durationMinutes: 20,
      price: 250,
    };

    expect(toSalonServiceFields(value)).toEqual({
      name: 'Beard trim',
      description: '',
      category: 'beard_and_mustache',
      durationMinutes: 20,
      price: 250,
      currency: 'MDL',
      isActive: true,
    });
  });

  it('is null while a required number is empty', () => {
    expect(toSalonServiceFields({ ...EMPTY_SALON_SERVICE_FORM_VALUE, name: 'X', category: 'haircut' })).toBeNull();
  });
});
