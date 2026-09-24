import type { SalonMasterStatus } from '../core/api/salon-masters.client';
import type { CardHeader } from './profile-card/profile-card.model';

/** The three states a Салон, a Незалежний майстер and a Клієнт each wear. */
export type ProfileStatus = 'active' | 'blocked' | 'deleted';

/** How each state is tagged — the lists and the cards mark every kind of profile the same way. */
export const PROFILE_STATUS_SEVERITY: Record<ProfileStatus, 'success' | 'warn' | 'danger'> = {
  active: 'success',
  blocked: 'warn',
  deleted: 'danger',
};

/**
 * How a Майстер салону's link to the Ростер is tagged — on the Ростер and on his card alike. It is
 * the state of the collaboration, not of his account: `INACTIVE` is one that has ended.
 */
export const ROSTER_STATUS_SEVERITY: Record<SalonMasterStatus, 'success' | 'secondary' | 'warn'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  PENDING: 'warn',
};

/** A profile of one of the three states, with the moments that put it there. */
type ProfileState = {
  status: ProfileStatus;
  deletedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
};

/**
 * The header of a card whose profile is its own account — a Салон, a Незалежний майстер, a Клієнт:
 * its state tag and the two banners that explain a state that is not active.
 */
export function profileHeader(profile: ProfileState, title: string, subject = title): CardHeader {
  return {
    title,
    subject,
    tag: {
      labelKey: `profile.status.${profile.status}`,
      severity: PROFILE_STATUS_SEVERITY[profile.status],
    },
    active: profile.status === 'active',
    owner: false,
    context: null,
    deleted: profile.status === 'deleted' ? { at: profile.deletedAt } : null,
    blocked: profile.blockedAt ? { at: profile.blockedAt, reason: profile.blockedReason } : null,
  };
}
