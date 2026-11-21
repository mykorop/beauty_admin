import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { map } from 'rxjs';
import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_ROLE_FILTERS,
  ACTIVITY_SERVICES,
} from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { activityFeed } from '../../shared/activity/activity-feed';
import { ActivityTable } from '../../shared/activity/activity.table';
import {
  ACTIVITY_ROUTE_KEY_PREFIX,
  activityRoleLabel,
  activityRouteLabel,
} from '../../shared/activity/activity-wording';
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

/**
 * «Журнал активності»: every change anybody made on the platform and every request that failed,
 * newest first — today unless the address names a period, narrowed by an account, a Місце, a role,
 * an outcome, a service or an action. Built as the «Журнал дій» is: the address owns the filters, so
 * a copied link reopens the same view, and the backend does the filtering and hands the log over a
 * page at a time. Its entries read as on a card's «Активність» (`ActivityTable`).
 */
@Component({
  selector: 'app-activity-log-page',
  imports: [
    ActivityTable,
    Button,
    ButtonDirective,
    FormsModule,
    InputText,
    Select,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './activity-log.page.html',
})
export class ActivityLogPage {
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
      label:
        value === 'anonymous'
          ? this.i18n.t('activityLog.anonymous')
          : activityRoleLabel(this.i18n, value),
    })),
  );
  protected readonly outcomeOptions = computed(() =>
    ACTIVITY_OUTCOMES.map((value) => ({ value, label: this.i18n.t(`activityLog.outcome.${value}`) })),
  );
  protected readonly serviceOptions = computed(() =>
    ACTIVITY_SERVICES.map((value) => ({ value, label: this.i18n.t(`activityLog.service.${value}`) })),
  );

  /** New filters, or «Оновити», start the log over; a page asked under the old ones is dropped. */
  protected readonly log = activityFeed(() => toApiFilters(this.filters()));

  /** The actions the dictionaries word, in their order. */
  private readonly wordedRoutes = this.i18n.wordedUnder(ACTIVITY_ROUTE_KEY_PREFIX);
  /**
   * What the action filter offers: the worded actions, then any other the rows shown carry and the
   * one the address names — an action not worded yet can be picked once it is seen.
   */
  protected readonly routeOptions = computed(() => {
    const seen = (this.log.items() ?? []).map((entry) => entry.route);
    const chosen = this.filters().route;
    const routes = [...new Set([...this.wordedRoutes, ...seen, ...(chosen ? [chosen] : [])])];
    return routes.map((value) => ({ value, label: activityRouteLabel(this.i18n, value) }));
  });

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

  private navigate(filters: ActivityLogFilters): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(filters) });
  }
}
