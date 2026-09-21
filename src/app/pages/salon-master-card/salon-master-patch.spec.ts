import type { SalonMaster } from '../../core/api/salon-masters.client';
import { buildSalonMasterPatch, toSalonMasterFormValue } from './salon-master-patch';

const MASTER: SalonMaster = {
  masterId: 'm2',
  isOwner: false,
  masterName: 'Ion Popa',
  masterAvatar: '',
  email: 'ion@bookme.md',
  specialization: 'barber',
  status: 'ACTIVE',
  commissionPercent: 40,
  bookingForwardDays: 14,
  rating: 4.6,
  reviewCount: 7,
  joinedAt: '2026-02-01T09:00:00.000Z',
  updatedAt: null,
};

describe('buildSalonMasterPatch', () => {
  it('is empty for an untouched form', () => {
    expect(buildSalonMasterPatch(MASTER, toSalonMasterFormValue(MASTER))).toEqual({});
  });

  it('carries only what changed', () => {
    const value = {
      ...toSalonMasterFormValue(MASTER),
      commissionPercent: 50,
      specialization: 'cosmetologist',
    };

    expect(buildSalonMasterPatch(MASTER, value)).toEqual({
      commissionPercent: 50,
      specialization: 'cosmetologist',
    });
  });

  it('treats an emptied number as untouched — the form refuses to save it anyway', () => {
    const value = { ...toSalonMasterFormValue(MASTER), bookingForwardDays: null };

    expect(buildSalonMasterPatch(MASTER, value)).toEqual({});
  });

  it('never carries the link status, whatever the form value holds', () => {
    const value = { ...toSalonMasterFormValue(MASTER), status: 'INACTIVE' } as never;

    expect(buildSalonMasterPatch(MASTER, value)).toEqual({});
  });
});
