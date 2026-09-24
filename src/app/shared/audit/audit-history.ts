import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { AuditClient } from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { feed } from '../feed';
import { LOADED_CARD } from '../profile-card/loaded-card';
import { formatVenueDateTime } from '../venue-date';
import { AuditEntryDetails } from './audit-entry-details';

/**
 * «Історія» of a card: the Журнал дій rows about its profile, newest first. Read again every time
 * the tab opens, so an edit saved a moment ago on another tab is already here.
 *
 * Shared by the cards of a Салон, a Незалежний майстер and a Клієнт — they read the same log and
 * must not word it differently. The card's scope says whose rows to ask for and on whose clock to
 * date them; its kind, how an empty one reads.
 */
@Component({
  selector: 'app-audit-history',
  imports: [AuditEntryDetails, ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  template: `
    @if (history.items(); as entries) {
      <div class="flex max-w-4xl flex-col gap-3">
        @for (entry of entries; track entry.auditId) {
          <article class="audit-history-card rounded-lg border border-divider bg-panel p-4 text-sm" data-testid="history-entry">
            <header class="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 class="font-semibold">{{ actionLabel(entry.action) }}</h2>
              <span class="text-muted">{{ venueDate(entry.createdAt) }}</span>
              <span class="text-muted">{{ entry.adminEmail || entry.adminId }}</span>
            </header>
            <app-audit-entry-details [entry]="entry" />
          </article>
        } @empty {
          <p class="content-state text-muted" data-testid="history-empty">{{ emptyKey | t }}</p>
        }
        @if (history.hasMore()) {
          <div>
            <button
              pButton
              type="button"
              severity="secondary"
              size="small"
              data-testid="history-more"
              [label]="'history.more' | t"
              [loading]="history.loading()"
              (click)="history.loadMore()"
            ></button>
          </div>
        }
      </div>
    } @else if (history.failed()) {
      <p class="content-state text-danger" role="alert" data-testid="history-failed">{{ 'card.failed' | t }}</p>
    } @else {
      <p class="content-state text-muted" role="status" data-testid="history-loading">{{ 'common.loading' | t }}</p>
    }
  `,
})
export class AuditHistory {
  private readonly i18n = inject(I18nService);
  private readonly client = inject(AuditClient);

  private readonly card = inject(LOADED_CARD);
  private readonly scope = this.card.scope;
  /** Whose rows: one profile's for as long as the tab stands, whatever changes on it meanwhile. */
  private readonly audit = this.scope().audit;
  protected readonly emptyKey = this.card.kind.copy.historyEmpty ?? 'history.empty';

  protected readonly history = feed({
    query: () => this.audit,
    read: ({ type, id }, cursor) => this.client.forTarget(type, id, cursor),
  });

  /** The profile's own clock: every moment of a card is dated on it, never on the browser's. */
  protected venueDate(iso: string): string {
    return formatVenueDateTime(iso, this.i18n.locale(), this.scope().timezone);
  }

  protected actionLabel(action: string): string {
    return this.i18n.optional(`audit.action.${action}`) ?? action;
  }
}
