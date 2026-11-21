import type { MasterSalon } from '../../core/api/masters.client';
import {
  masterClientVisibility,
  ownClientVisibility,
  salonMasterClientVisibility,
} from './client-visibility';

const OLENA = { actorId: 'u1', actorRole: 'salon_admin', actorName: 'Olena Popa' } as const;
const CHOSEN_AT = '2026-11-20T09:00:00.000Z';

describe('the Видимість a card shows', () => {
  describe('of a Салон or a Незалежний майстер — its own', () => {
    it('is the state, the prices and who chose them when', () => {
      expect(
        ownClientVisibility({
          clientVisibility: 'link',
          pricesHidden: true,
          clientVisibilityUpdatedAt: CHOSEN_AT,
          clientVisibilityUpdatedBy: OLENA,
        }),
      ).toEqual({
        decidedBy: 'own',
        visibility: 'link',
        pricesHidden: true,
        lastChange: { at: CHOSEN_AT, by: 'Olena Popa' },
      });
    });

    it('names no change where nobody ever chose it — a Прихований set by the backfill', () => {
      expect(
        ownClientVisibility({
          clientVisibility: 'hidden',
          pricesHidden: false,
          clientVisibilityUpdatedAt: null,
          clientVisibilityUpdatedBy: null,
        }),
      ).toEqual({ decidedBy: 'own', visibility: 'hidden', pricesHidden: false, lastChange: null });
    });

    it('says nothing it was not told by an admin-api from before Видимість — never Публічний', () => {
      expect(ownClientVisibility({})).toEqual({
        decidedBy: 'own',
        visibility: null,
        pricesHidden: null,
        lastChange: null,
      });
    });
  });

  describe('of a Майстер, as GET /admin/masters/{masterId} answers', () => {
    const OWN = {
      clientVisibility: 'link',
      pricesHidden: false,
      clientVisibilityUpdatedAt: CHOSEN_AT,
      clientVisibilityUpdatedBy: { actorId: 'm1', actorRole: 'master', actorName: 'Ion Popa' },
    } as const;
    const salon = (overrides: Partial<MasterSalon> = {}): MasterSalon => ({
      salonId: 's1',
      name: 'Beauty Lab',
      status: 'active',
      clientVisibility: 'hidden',
      pricesHidden: true,
      current: false,
      joinedAt: '2026-02-01T09:00:00.000Z',
      leftAt: '2026-07-01T12:00:00.000Z',
      ...overrides,
    });

    it('is his own for a Незалежний майстер — not that of the Салон he has left', () => {
      expect(masterClientVisibility({ ...OWN, salon: salon() })).toEqual({
        decidedBy: 'own',
        visibility: 'link',
        pricesHidden: false,
        lastChange: { at: CHOSEN_AT, by: 'Ion Popa' },
      });
      expect(masterClientVisibility({ ...OWN, salon: null }).visibility).toBe('link');
    });

    it('is his Салон’s for a Майстер салону — never his own, unread while he is on the Ростер', () => {
      const current = salon({ current: true, leftAt: null });

      expect(masterClientVisibility({ ...OWN, salon: current })).toEqual({
        decidedBy: 'salon',
        visibility: 'hidden',
        pricesHidden: true,
        lastChange: null,
      });
    });

    it('is a dash, not Публічний, for a Майстер салону whose Салон’s row is gone', () => {
      const gone = salon({
        current: true,
        name: '',
        status: null,
        clientVisibility: null,
        pricesHidden: null,
      });

      expect(masterClientVisibility({ ...OWN, salon: gone })).toEqual({
        decidedBy: 'salon',
        visibility: null,
        pricesHidden: null,
        lastChange: null,
      });
    });
  });

  describe('of a Майстер салону, on his card inside the Салон', () => {
    const SALON = {
      clientVisibility: 'link',
      pricesHidden: true,
      clientVisibilityUpdatedAt: CHOSEN_AT,
      clientVisibilityUpdatedBy: OLENA,
    } as const;

    it('is the Салон’s while he is on its Ростер', () => {
      expect(salonMasterClientVisibility({ status: 'ACTIVE' }, SALON)).toEqual({
        decidedBy: 'salon',
        visibility: 'link',
        pricesHidden: true,
        lastChange: null,
      });
    });

    it('is a dash, not Публічний, where the Салон’s card does not say', () => {
      expect(salonMasterClientVisibility({ status: 'ACTIVE' }, {})).toEqual({
        decidedBy: 'salon',
        visibility: null,
        pricesHidden: null,
        lastChange: null,
      });
    });

    it('is nothing once the collaboration has ended: the Салон’s is no longer what he lives by', () => {
      expect(salonMasterClientVisibility({ status: 'INACTIVE' }, SALON)).toBeNull();
      expect(salonMasterClientVisibility({ status: 'PENDING' }, SALON)).toBeNull();
    });
  });
});
