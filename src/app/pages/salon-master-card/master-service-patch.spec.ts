import type { MasterService } from '../../core/api/salon-master-services.client';
import type { SalonService } from '../../core/api/salon-services.client';
import {
  buildMasterServicePatch,
  EMPTY_MASTER_SERVICE_FORM_VALUE,
  fromCatalogService,
  isOffered,
  servicesWithoutCopy,
  toMasterServiceFormValue,
  toNewMasterService,
} from './master-service-patch';

const COPY: MasterService = {
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 45,
  price: 700,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  catalog: { durationMinutes: 30, price: 500, isActive: true },
  createdAt: '2026-04-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const catalogService = (overrides: Partial<SalonService>): SalonService => ({
  serviceId: 'svc1',
  name: 'Haircut',
  description: '',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  masterCopyCount: 0,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('buildMasterServicePatch', () => {
  it('is empty for an untouched form', () => {
    expect(buildMasterServicePatch(COPY, toMasterServiceFormValue(COPY))).toEqual({});
  });

  it('carries only what changed', () => {
    const value = { ...toMasterServiceFormValue(COPY), price: 800, isActive: false };

    expect(buildMasterServicePatch(COPY, value)).toEqual({ price: 800, isActive: false });
  });

  it('treats an emptied number as untouched — the form refuses to save it anyway', () => {
    const value = { ...toMasterServiceFormValue(COPY), durationMinutes: null };

    expect(buildMasterServicePatch(COPY, value)).toEqual({});
  });

  it('never carries the service itself', () => {
    const value = { ...toMasterServiceFormValue(COPY), serviceId: 'svc2' };

    expect(buildMasterServicePatch(COPY, value)).toEqual({});
  });
});

describe('toNewMasterService', () => {
  it('starts a new Копія from the Каталог values', () => {
    const value = fromCatalogService(catalogService({ serviceId: 'svc2', price: 250, durationMinutes: 20 }));

    expect(toNewMasterService(value)).toEqual({
      serviceId: 'svc2',
      price: 250,
      durationMinutes: 20,
    });
  });

  it('is null until a service is chosen and both numbers are typed', () => {
    expect(toNewMasterService(EMPTY_MASTER_SERVICE_FORM_VALUE)).toBeNull();
    expect(toNewMasterService({ ...fromCatalogService(catalogService({})), price: null })).toBeNull();
  });

  it('accepts a free service', () => {
    expect(toNewMasterService({ ...fromCatalogService(catalogService({})), price: 0 })?.price).toBe(0);
  });
});

describe('servicesWithoutCopy', () => {
  it('leaves out what the master already holds, active services first, then by name', () => {
    const catalog = [
      catalogService({ serviceId: 'svc1' }),
      catalogService({ serviceId: 'svc2', name: 'Styling' }),
      catalogService({ serviceId: 'svc3', name: 'Beard trim', isActive: false }),
      catalogService({ serviceId: 'svc4', name: 'Coloring' }),
    ];

    expect(servicesWithoutCopy(catalog, [COPY], 'en').map((service) => service.serviceId)).toEqual([
      'svc4',
      'svc2',
      'svc3',
    ]);
  });
});

describe('isOffered', () => {
  it('needs both the Копія and the Каталог service switched on', () => {
    expect(isOffered(COPY)).toBeTrue();
    expect(isOffered({ ...COPY, isActive: false })).toBeFalse();
    expect(isOffered({ ...COPY, catalog: { ...COPY.catalog!, isActive: false } })).toBeFalse();
    expect(isOffered({ ...COPY, catalog: null })).toBeFalse();
  });
});
