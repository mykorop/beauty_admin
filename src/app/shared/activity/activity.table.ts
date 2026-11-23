import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import type { ActivityEntry, ActivityOutcome, ActivityPlace } from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { PLATFORM_TIME_ZONE } from '../platform-clock';
import { formatVenueDateTime } from '../venue-date';
import { ActivityEntryDetails } from './activity-entry-details';
import type { ActivityFeed } from './activity-feed';
import { actorCardLink, placeCardLink } from './activity-links';
import { activityRoleLabel, activityRouteLabel, activityTriggerLabel } from './activity-wording';

/** How each outcome is marked, so a problem stands out: a refusal warns, a failure alarms. */
const OUTCOME_SEVERITY: Record<ActivityOutcome, 'success' | 'warn' | 'danger'> = {
  ok: 'success',
  rejected: 'warn',
  failed: 'danger',
};

/**
 * The entries of an `ActivityFeed`: who acted and where, each linked to its card, what was done
 * (for a Cognito trigger's entry, what Cognito did it for), how it ended and how long it took, on the platform's clock — a row opening into its details —
 * with the next page on demand, and a word for a feed still loading, empty or refused. One table
 * for the screen and for every card's «Активність», so an entry reads the same wherever it is
 * shown; what is asked, and «Оновити», are the host's.
 */
@Component({
  selector: 'app-activity-table',
  imports: [ActivityEntryDetails, ButtonDirective, RouterLink, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let log = feed();
    @if (log.items(); as entries) {
      <div
        class="profile-table-scroll"
        role="region"
        tabindex="0"
        [attr.aria-label]="'nav.activityLog' | t"
      >
        <table class="profile-data-table audit-table" data-testid="activity-table">
          <thead class="bg-raised text-xs text-muted">
            <tr>
              <th class="px-3 py-2"></th>
              <th class="px-3 py-2 font-medium">{{ 'auditLog.column.time' | t }}</th>
              <th class="px-3 py-2 font-medium">{{ 'activityLog.column.actor' | t }}</th>
              <th class="px-3 py-2 font-medium">{{ 'activityLog.column.place' | t }}</th>
              <th class="px-3 py-2 font-medium">{{ 'auditLog.column.action' | t }}</th>
              <th class="px-3 py-2 font-medium">{{ 'activityLog.column.outcome' | t }}</th>
              <th class="px-3 py-2 font-medium">{{ 'activityLog.column.duration' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries; track entry.activityId) {
              <tr
                class="cursor-pointer border-t border-divider hover:bg-raised"
                data-testid="activity-row"
                (click)="toggle(entry, $event)"
              >
                <td class="px-3 py-2">
                  <!-- The row toggles on its own click; the button is the keyboard's way in. -->
                  <button
                    type="button"
                    class="audit-toggle pi text-muted"
                    data-testid="activity-row-toggle"
                    [class.pi-chevron-right]="!isExpanded(entry)"
                    [class.pi-chevron-down]="isExpanded(entry)"
                    [attr.aria-expanded]="isExpanded(entry)"
                    [attr.aria-label]="'activityLog.details' | t"
                  ></button>
                </td>
                <td class="px-3 py-2 whitespace-nowrap" data-testid="activity-time">
                  {{ formatTime(entry.createdAt) }}
                </td>
                <td class="px-3 py-2" data-testid="activity-actor">
                  @if (entry.actor; as actor) {
                    @if (actorLink(actor); as link) {
                      <a
                        class="font-medium hover:underline"
                        data-testid="activity-actor-link"
                        [class.font-mono]="!actor.name"
                        [routerLink]="link"
                        >{{ actor.name ?? actor.id }}</a
                      >
                    } @else {
                      <span [class.font-mono]="!actor.name">{{ actor.name ?? actor.id }}</span>
                    }
                    <span class="block text-xs text-muted">{{ roleLabel(actor.role) }}</span>
                  } @else {
                    <span class="text-muted">{{ 'activityLog.anonymous' | t }}</span>
                    @if (entry.claimedActorId; as claimed) {
                      <span class="block text-xs" data-testid="activity-claimed-actor">
                        <span class="font-mono">{{ claimed }}</span>
                        <p-tag
                          class="ml-1"
                          severity="warn"
                          [value]="'activityLog.unverified' | t"
                        />
                      </span>
                    }
                  }
                </td>
                <td class="px-3 py-2" data-testid="activity-place">
                  @if (entry.place; as place) {
                    <a
                      class="font-medium hover:underline"
                      [class.font-mono]="!place.name"
                      [routerLink]="placeLink(place)"
                      >{{ place.name ?? place.id }}</a
                    >
                    <span class="block text-xs text-muted">{{ placeTypeLabel(place) }}</span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                <td class="px-3 py-2" data-testid="activity-action">
                  {{ actionLabel(entry) }}
                  @if (entry.triggerSource; as triggerSource) {
                    <span class="block text-xs text-muted" data-testid="activity-trigger">{{
                      triggerLabel(triggerSource)
                    }}</span>
                  }
                </td>
                <td class="px-3 py-2">
                  <p-tag
                    data-testid="activity-outcome"
                    [severity]="outcomeSeverity(entry)"
                    [value]="outcomeLabel(entry)"
                  />
                </td>
                <td class="px-3 py-2 whitespace-nowrap" data-testid="activity-duration">
                  {{ 'activityLog.durationMs' | t: { ms: entry.durationMs } }}
                </td>
              </tr>
              @if (isExpanded(entry)) {
                <tr class="border-t border-divider bg-raised" data-testid="activity-details">
                  <td></td>
                  <td colspan="6" class="px-3 py-3">
                    <app-activity-entry-details [entry]="entry" />
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="7" class="py-8 text-center text-muted" data-testid="activity-empty">
                  {{ (log.hasMore() ? 'auditLog.emptyPage' : 'list.empty') | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (log.hasMore()) {
        <div class="mt-3">
          <button
            pButton
            type="button"
            severity="secondary"
            size="small"
            data-testid="activity-more"
            [label]="'history.more' | t"
            [loading]="log.loading()"
            (click)="log.loadMore()"
          ></button>
        </div>
      }
    } @else if (log.failed()) {
      <p class="content-state text-danger" role="alert" data-testid="activity-failed">
        {{ 'list.failed' | t }}
      </p>
    } @else {
      <p class="content-state text-muted" role="status" data-testid="activity-loading">
        {{ 'common.loading' | t }}
      </p>
    }
  `,
})
export class ActivityTable {
  private readonly i18n = inject(I18nService);

  readonly feed = input.required<ActivityFeed>();

  /** Where the card of whoever acted, and of the Місце, lives. */
  protected readonly actorLink = actorCardLink;
  protected readonly placeLink = placeCardLink;

  protected isExpanded(entry: ActivityEntry): boolean {
    return this.feed().expanded().has(entry.activityId);
  }

  protected toggle(entry: ActivityEntry, event: MouseEvent): void {
    // A name or a Місце is a real link to its card; let it handle its own clicks.
    if ((event.target as HTMLElement).closest('a')) {
      return;
    }
    this.feed().expanded.update((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(entry.activityId)) {
        next.add(entry.activityId);
      }
      return next;
    });
  }

  protected actionLabel(entry: ActivityEntry): string {
    return activityRouteLabel(this.i18n, entry.route);
  }

  /** What Cognito sent a code for, or signed the account up by, under an entry of the `cognito` service. */
  protected triggerLabel(triggerSource: string): string {
    return activityTriggerLabel(this.i18n, triggerSource);
  }

  /** «Салон» or «Майстер» — which kind of Місце it is. */
  protected placeTypeLabel(place: ActivityPlace): string {
    return this.i18n.t(`activityLog.place.${place.type}`);
  }

  protected roleLabel(role: string): string {
    return activityRoleLabel(this.i18n, role);
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
    // The time a user names is the platform's, wherever the card's venue is.
    return formatVenueDateTime(iso, this.i18n.locale(), PLATFORM_TIME_ZONE);
  }
}
