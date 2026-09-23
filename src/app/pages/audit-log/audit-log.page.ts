import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { map } from 'rxjs';
import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  AuditClient,
  type AuditEntry,
} from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { AuditEntryDetails } from '../../shared/audit/audit-entry-details';
import { feed } from '../../shared/feed';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { formatVenueDateTime } from '../../shared/venue-date';
import {
  type AuditLogFilters,
  NO_AUDIT_LOG_FILTERS,
  parseAuditLogFilters,
  toApiFilters,
  toQueryParams,
} from './audit-log-filters';

/** Where the card of each kind of target lives. A backend ahead of this list serves kinds it lacks. */
const TARGET_CARD_ROUTE: Partial<Record<string, (entry: AuditEntry) => string[] | null>> = {
  salon: (entry) => ['/salons', entry.targetId],
  // A Майстер салону lives inside his Салон; the card of a Незалежний майстер is not built yet.
  master: (entry) => (entry.salonId ? ['/salons', entry.salonId, 'masters', entry.targetId] : null),
};

/**
 * «Журнал дій»: every change the Адміністратор платформи made across the platform, newest first.
 * The address owns the filters, so a copied link reopens the same view; the backend does the
 * filtering and hands the log over a page at a time.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [AuditEntryDetails, Button, ButtonDirective, FormsModule, InputText, RouterLink, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './audit-log.page.html',
})
export class AuditLogPage {
  private readonly client = inject(AuditClient);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(parseAuditLogFilters)), {
    initialValue: parseAuditLogFilters(this.route.snapshot.queryParamMap),
  });
  protected readonly filtered = computed(() => Object.values(this.filters()).some((value) => value !== null));

  /** New filters, or «Оновити», start the log over; a page asked under the old ones is dropped. */
  protected readonly log = feed({
    query: () => toApiFilters(this.filters()),
    read: (query, cursor) => this.client.list(query, cursor),
  });
  private readonly expanded = this.log.listState<ReadonlySet<string>>(new Set());

  protected readonly targetTypeOptions = computed(() =>
    AUDIT_TARGET_TYPES.map((value) => ({ value, label: this.i18n.t(`audit.targetType.${value}`) })),
  );
  protected readonly actionOptions = computed(() =>
    AUDIT_ACTIONS.map((value) => ({ value, label: this.i18n.t(`audit.action.${value}`) })),
  );

  protected setFilter(change: Partial<AuditLogFilters>): void {
    // A cleared date input reports '', a cleared select `null`.
    const normalised = Object.fromEntries(Object.entries(change).map(([key, value]) => [key, value || null]));
    this.navigate({ ...this.filters(), ...normalised });
  }

  protected resetFilters(): void {
    this.navigate(NO_AUDIT_LOG_FILTERS);
  }

  protected isExpanded(entry: AuditEntry): boolean {
    return this.expanded().has(entry.auditId);
  }

  protected toggle(entry: AuditEntry, event: MouseEvent): void {
    // The target is a real link; let it handle its own clicks.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    this.expanded.update((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(entry.auditId)) {
        next.add(entry.auditId);
      }
      return next;
    });
  }

  protected targetLink(entry: AuditEntry): string[] | null {
    return TARGET_CARD_ROUTE[entry.targetType]?.(entry) ?? null;
  }

  protected actionLabel(action: string): string {
    return this.i18n.optional(`audit.action.${action}`) ?? action;
  }

  protected targetTypeLabel(type: string): string {
    return this.i18n.optional(`audit.targetType.${type}`) ?? type;
  }

  protected formatTime(iso: string): string {
    return formatVenueDateTime(iso, this.i18n.locale(), PLATFORM_TIME_ZONE);
  }

  private navigate(filters: AuditLogFilters): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(filters) });
  }
}
