import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { AuditEntry } from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * What one Журнал дій entry did: the old and new value of every changed field — in full, PII
 * included — the reason, and for a bulk action everything it touched. Shared by the «Історія» tab
 * of a card and the «Журнал дій» screen, so the two cannot word the same row differently.
 */
@Component({
  selector: 'app-audit-entry-details',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entry().changes.length > 0) {
      <table class="w-full table-fixed text-left">
        <thead class="text-xs text-slate-500">
          <tr>
            <th class="w-1/4 py-1 font-normal">{{ 'history.field' | t }}</th>
            <th class="py-1 font-normal">{{ 'history.before' | t }}</th>
            <th class="py-1 font-normal">{{ 'history.after' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (change of entry().changes; track change.field) {
            <tr class="border-t border-slate-100 align-top" data-testid="history-change">
              <td class="py-1 pr-3">{{ fieldLabel(change.field) }}</td>
              <td class="py-1 pr-3 break-words whitespace-pre-line text-slate-500">
                {{ display(change.before) }}
              </td>
              <td class="py-1 break-words whitespace-pre-line">{{ display(change.after) }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
    @if (entry().reason; as reason) {
      <p class="mt-2 text-slate-600" data-testid="history-reason">{{ 'history.reason' | t: { reason } }}</p>
    }
    @if (affected().length > 0) {
      <div class="mt-2" data-testid="history-affected">
        <p class="text-slate-600">{{ 'history.affected' | t: { count: affected().length } }}</p>
        <ul class="mt-1 list-inside list-disc">
          @for (entity of affected(); track entity.type + ':' + entity.id) {
            <li data-testid="history-affected-entity">{{ typeLabel(entity.type) }} {{ entity.id }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class AuditEntryDetails {
  private readonly i18n = inject(I18nService);

  readonly entry = input.required<AuditEntry>();
  protected readonly affected = computed(() => this.entry().affected ?? []);

  /** A field is named as its card's own tab names it; anything else keeps its raw path. */
  protected fieldLabel(field: string): string {
    const key = `${this.entry().targetType}.field.${FIELD_LABEL_ALIASES[field] ?? field}`;
    return this.i18n.optional(key) ?? field;
  }

  protected typeLabel(type: string): string {
    return this.i18n.optional(`audit.targetType.${type}`) ?? type;
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }
}

/** Row attributes whose label on the card lives under another name. */
const FIELD_LABEL_ALIASES: Record<string, string> = {
  bufferMinutes: 'buffer',
  bookingForwardDays: 'bookingHorizon',
};
