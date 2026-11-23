import type { ActivityEffect, ActivityEntry } from '../../core/api/activity.client';
import type { I18nService } from '../../i18n/i18n.service';
import { type AuditRowLink, auditRowLink, recipientCardLink } from './activity-links';
import { activityRoleLabel } from './activity-wording';

/**
 * What a request caused, as the details of its Журнал активності entry word it: one line an effect,
 * in the order it happened. Shared, like `ActivityEntryDetails`, so the «Активність» tab of a card
 * words an entry as the screen does.
 */

/** How a delivery's tag is coloured: `secondary` for a result the panel does not know yet. */
export type EffectSeverity = 'success' | 'danger' | 'warn' | 'secondary';

const RESULT_SEVERITY: Partial<Record<string, EffectSeverity>> = {
  sent: 'success',
  failed: 'danger',
  'invalid-token': 'warn',
};

/** One effect, worded: a try to deliver, or a Журнал дій row the request wrote. */
export type EffectLine =
  | {
      kind: 'delivery';
      /** Push, SMS, Email. */
      channel: string;
      /** The account told — its role worded, its card where it has one; `null` for no account. */
      recipient: { id: string; role: string | null; link: string[] | null } | null;
      result: string;
      severity: EffectSeverity;
      /** Why it did not go, as whoever said no named it. */
      code: string | null;
    }
  | {
      kind: 'audit';
      channel: string;
      action: string;
      target: string;
      targetId: string;
      /** Where the row is read, with its old and new values. */
      link: AuditRowLink;
      linkLabel: string;
    };

/** What `entry` caused, one line an effect; none for an entry from before effects were kept. */
export function effectLinesOf(
  i18n: I18nService,
  entry: Pick<ActivityEntry, 'effects' | 'createdAt'>,
): EffectLine[] {
  return (entry.effects ?? []).map((effect) => lineOf(i18n, effect, entry.createdAt));
}

/** A channel, a result, an action or a target the panel does not word yet is shown as it came. */
const worded = (i18n: I18nService, key: string, raw: string): string => i18n.optional(key) ?? raw;

function lineOf(i18n: I18nService, effect: ActivityEffect, createdAt: string): EffectLine {
  const channel = worded(i18n, `activityLog.effect.kind.${effect.kind}`, effect.kind);
  if (effect.kind === 'audit') {
    const link = auditRowLink(effect, createdAt);
    return {
      kind: 'audit',
      channel,
      action: worded(i18n, `audit.action.${effect.action}`, effect.action),
      target: worded(i18n, `audit.targetType.${effect.target.type}`, effect.target.type),
      targetId: effect.target.id,
      link,
      linkLabel: i18n.t(link.to === 'history' ? 'activityLog.effect.openHistory' : 'activityLog.effect.openAuditLog'),
    };
  }
  const { recipient } = effect;
  return {
    kind: 'delivery',
    channel,
    recipient: recipient && {
      id: recipient.id,
      role: recipient.role && activityRoleLabel(i18n, recipient.role),
      link: recipientCardLink(recipient),
    },
    result: worded(i18n, `activityLog.effect.result.${effect.result}`, effect.result),
    severity: RESULT_SEVERITY[effect.result] ?? 'secondary',
    code: effect.code ?? null,
  };
}
