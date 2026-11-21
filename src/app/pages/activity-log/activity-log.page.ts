import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { map } from 'rxjs';
import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_ROLE_FILTERS,
  ACTIVITY_SERVICES,
  ActivityClient,
  type ActivityEntry,
  type ActivityOutcome,
  type ActivityPlace,
} from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ActivityEntryDetails } from '../../shared/activity/activity-entry-details';
import { actorCardLink, placeCardLink } from '../../shared/activity/activity-links';
import { feed } from '../../shared/feed';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { formatVenueDateTime } from '../../shared/venue-date';
import {
  type ActivityLogFilterChange,
  type ActivityLogFilters,
  changeFilters,
  NO_ACTIVITY_LOG_FILTERS,
  openPeriod,
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

/** Where the dictionaries word an action: `activity.route.<routeKey>`. */
const ROUTE_KEY_PREFIX = 'activity.route.';

/**
 * «Журнал активності»: every change anybody made on the platform and every request that failed,
 * newest first — today unless the address names a period, narrowed by an account, a Місце, a role,
 * an outcome, a service or an action. Built as the «Журнал дій» is: the address owns the filters, so
 * a copied link reopens the same view, and the backend does the filtering and hands the log over a
 * page at a time.
 */
@Component({
  selector: 'app-activity-log-page',
  imports: [
    ActivityEntryDetails,
    Button,
    ButtonDirective,
    FormsModule,
    InputText,
    RouterLink,
    Select,
    Tag,
    TranslatePipe,
  ],
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
  /** «Today», or «all that is kept» for an account or a Місце, while no period is set. */
  protected readonly openPeriod = computed(() => openPeriod(this.filters()));

  protected readonly roleOptions = computed(() =>
    ACTIVITY_ROLE_FILTERS.map((value) => ({
      value,
      label: value === 'anonymous' ? this.i18n.t('activityLog.anonymous') : this.roleLabel(value),
    })),
  );
  protected readonly outcomeOptions = computed(() =>
    ACTIVITY_OUTCOMES.map((value) => ({ value, label: this.i18n.t(`activityLog.outcome.${value}`) })),
  );
  protected readonly serviceOptions = computed(() =>
    ACTIVITY_SERVICES.map((value) => ({ value, label: this.i18n.t(`activityLog.service.${value}`) })),
  );

  /** New filters, or «Оновити», start the log over; a page asked under the old ones is dropped. */
  protected readonly log = feed({
    query: () => toApiFilters(this.filters()),
    read: (query, cursor) => this.client.list(query, cursor),
  });
  private readonly expanded = this.log.listState<ReadonlySet<string>>(new Set());

  /** The actions the dictionaries word, in their order. */
  private readonly wordedRoutes = this.i18n.wordedUnder(ROUTE_KEY_PREFIX);
  /**
   * What the action filter offers: the worded actions, then any other the rows shown carry and the
   * one the address names — an action not worded yet can be picked once it is seen.
   */
  protected readonly routeOptions = computed(() => {
    const seen = (this.log.items() ?? []).map((entry) => entry.route);
    const chosen = this.filters().route;
    const routes = [...new Set([...this.wordedRoutes, ...seen, ...(chosen ? [chosen] : [])])];
    return routes.map((value) => ({ value, label: this.routeLabel(value) }));
  });

  /** Where the card of whoever acted, and of the Місце, lives — the «Активність» tab links them alike. */
  protected readonly actorLink = actorCardLink;
  protected readonly placeLink = placeCardLink;

  protected setFilter(change: ActivityLogFilterChange): void {
    this.navigate(changeFilters(this.filters(), change));
  }

  /**
   * A typed account or Місце, once the input is left. The input is set to what the filter became —
   * trimmed, or empty for a value no account has — since the address may not change at all.
   */
  protected setTyped(name: 'account' | 'place', event: Event): void {
    const input = event.target as HTMLInputElement;
    const next = changeFilters(this.filters(), { [name]: input.value });
    input.value = next[name] ?? '';
    this.navigate(next);
  }

  protected resetFilters(): void {
    this.navigate(NO_ACTIVITY_LOG_FILTERS);
  }

  protected isExpanded(entry: ActivityEntry): boolean {
    return this.expanded().has(entry.activityId);
  }

  protected toggle(entry: ActivityEntry, event: MouseEvent): void {
    // A name or a Місце is a real link to its card; let it handle its own clicks.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
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
    return this.routeLabel(entry.route);
  }

  private routeLabel(route: string): string {
    return this.i18n.optional(`${ROUTE_KEY_PREFIX}${route}`) ?? route;
  }

  /** «Салон» or «Майстер» — which kind of Місце it is. */
  protected placeTypeLabel(place: ActivityPlace): string {
    return this.i18n.t(`activityLog.place.${place.type}`);
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
