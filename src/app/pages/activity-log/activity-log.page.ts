import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { map } from 'rxjs';
import { ActivityClient, type ActivityEntry, type ActivityOutcome } from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ActivityEntryDetails } from '../../shared/activity/activity-entry-details';
import { feed } from '../../shared/feed';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { formatVenueDateTime } from '../../shared/venue-date';
import {
  type ActivityLogFilters,
  changePeriod,
  NO_ACTIVITY_LOG_FILTERS,
  parseActivityLogFilters,
  toApiFilters,
  toQueryParams,
} from './activity-log-filters';

/** How each outcome is marked, so a problem stands out: a refusal warns, a failure alarms. */
const OUTCOME_SEVERITY: Record<ActivityOutcome, 'success' | 'warn' | 'danger'> = {
  ok: 'success',
  rejected: 'warn',
  failed: 'danger',
};

/**
 * «Журнал активності»: every change anybody made on the platform and every request that failed,
 * newest first — today unless the address names a period. Built as the «Журнал дій» is: the
 * address owns the period, so a copied link reopens the same view, and the backend hands the log
 * over a page at a time.
 */
@Component({
  selector: 'app-activity-log-page',
  imports: [ActivityEntryDetails, Button, ButtonDirective, InputText, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './activity-log.page.html',
})
export class ActivityLogPage {
  private readonly client = inject(ActivityClient);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(parseActivityLogFilters)), {
    initialValue: parseActivityLogFilters(this.route.snapshot.queryParamMap),
  });
  protected readonly filtered = computed(() => Object.values(this.filters()).some((value) => value !== null));

  /** A new period, or «Оновити», starts the log over; a page asked under the old one is dropped. */
  protected readonly log = feed({
    query: () => toApiFilters(this.filters()),
    read: (query, cursor) => this.client.list(query, cursor),
  });
  private readonly expanded = this.log.listState<ReadonlySet<string>>(new Set());

  protected setFilter(change: Partial<ActivityLogFilters>): void {
    // A cleared date input reports ''.
    const normalised = Object.fromEntries(Object.entries(change).map(([key, value]) => [key, value || null]));
    this.navigate(changePeriod(this.filters(), normalised));
  }

  protected resetFilters(): void {
    this.navigate(NO_ACTIVITY_LOG_FILTERS);
  }

  protected isExpanded(entry: ActivityEntry): boolean {
    return this.expanded().has(entry.activityId);
  }

  protected toggle(entry: ActivityEntry): void {
    this.expanded.update((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(entry.activityId)) {
        next.add(entry.activityId);
      }
      return next;
    });
  }

  /** The dictionaries word the most frequent routes; any other is shown as its `routeKey`. */
  protected actionLabel(entry: ActivityEntry): string {
    return this.i18n.optional(`activity.route.${entry.route}`) ?? entry.route;
  }

  protected roleLabel(role: string): string {
    return this.i18n.optional(`activityLog.role.${role}`) ?? role;
  }

  protected outcomeSeverity(entry: ActivityEntry): 'success' | 'warn' | 'danger' {
    return OUTCOME_SEVERITY[entry.outcome];
  }

  /** «Відмова · 409 · SLOT_UNAVAILABLE» — the mark, the status, and the error code when there is one. */
  protected outcomeLabel(entry: ActivityEntry): string {
    return [
      this.i18n.t(`activityLog.outcome.${entry.outcome}`),
      String(entry.status),
      ...(entry.error ? [entry.error.code] : []),
    ].join(' · ');
  }

  protected formatTime(iso: string): string {
    return formatVenueDateTime(iso, this.i18n.locale(), PLATFORM_TIME_ZONE);
  }

  private navigate(filters: ActivityLogFilters): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(filters) });
  }
}
