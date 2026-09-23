import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Subject, switchMap } from 'rxjs';
import {
  SALON_INVITE_STATUS_SEVERITY,
  type SalonInvite,
  type SalonInvitesPage,
  SalonMastersClient,
} from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { specializationLabel } from '../../shared/specialization';
import { SalonCardStore } from './salon-card.store';

/**
 * «Інвайти»: what the Салон has sent, newest first — to answer «the master never got the
 * invitation». Read-only: the panel neither sends nor revokes one.
 */
@Component({
  selector: 'app-salon-invites-tab',
  imports: [ButtonDirective, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows(); as rows) {
      <div
        class="profile-table-scroll"
        tabindex="0"
        role="region"
        [attr.aria-label]="'salon.tab.invites' | t"
      >
        <table class="profile-data-table">
          <thead class="text-xs text-muted">
            <tr class="border-b border-divider">
              <th class="px-4 py-3 font-normal">{{ 'invites.column.email' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'master.field.specialization' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'master.field.commissionPercent' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'invites.column.status' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'invites.column.createdAt' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'invites.column.expiresAt' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.invite.inviteId) {
              <tr class="border-b border-divider align-top last:border-0" data-testid="invite-row">
                <td class="px-4 py-3">{{ row.invite.email }}</td>
                <td class="px-4 py-3">{{ row.specialization }}</td>
                <td class="px-4 py-3">{{ row.invite.commissionPercent }}%</td>
                <td class="px-4 py-3">
                  <p-tag
                    data-testid="invite-status"
                    [severity]="row.statusSeverity"
                    [value]="row.statusKey | t"
                  />
                  @if (row.invite.deliveryFailed) {
                    <div class="mt-1 text-xs text-danger" data-testid="invite-delivery-failed">
                      {{ 'invites.deliveryFailed' | t }}
                    </div>
                  }
                  @if (row.invite.respondedAt) {
                    <div class="mt-1 text-xs text-muted">
                      {{
                        'invites.respondedAt' | t: { date: store.venueDate(row.invite.respondedAt) }
                      }}
                    </div>
                  }
                </td>
                <td class="px-4 py-3">{{ store.venueDate(row.invite.createdAt) }}</td>
                <td class="px-4 py-3" data-testid="invite-expiresAt">
                  {{ store.venueDate(row.invite.expiresAt) }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="py-8 text-center text-muted" data-testid="invites-empty">
                  {{ 'invites.empty' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-muted">{{ 'invites.readonly' | t }}</p>
      @if (nextCursor()) {
        <div class="mt-3">
          <button
            pButton
            type="button"
            severity="secondary"
            size="small"
            data-testid="invites-more"
            [label]="'history.more' | t"
            [loading]="loading()"
            (click)="more.next()"
          ></button>
        </div>
      }
    } @else if (failed()) {
      <p class="text-muted" data-testid="invites-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonInvitesTab {
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(SalonCardStore);

  private readonly invites = signal<SalonInvite[] | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly more = new Subject<void>();

  protected readonly rows = computed(
    () =>
      this.invites()?.map((invite) => ({
        invite,
        specialization: specializationLabel(this.i18n, invite.specialization),
        statusKey: `invites.status.${invite.status}` satisfies TranslationKey,
        statusSeverity: SALON_INVITE_STATUS_SEVERITY[invite.status] ?? 'secondary',
      })) ?? null,
  );

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    const salonId = this.store.salon()?.salonId;
    if (!salonId) {
      return;
    }
    const client = inject(SalonMastersClient);
    const loadPage = (cursor?: string) => {
      this.loading.set(true);
      return client.invites(salonId, cursor);
    };
    const appendPage = {
      next: ({ items, nextCursor }: SalonInvitesPage) => {
        this.invites.update((shown) => [...(shown ?? []), ...items]);
        this.nextCursor.set(nextCursor);
        this.loading.set(false);
      },
      // The interceptor has already worded the refusal as a toast.
      error: () => {
        this.failed.set(this.invites() === null);
        this.loading.set(false);
      },
    };
    loadPage().pipe(takeUntilDestroyed()).subscribe(appendPage);
    this.more
      .pipe(
        switchMap(() => loadPage(this.nextCursor() ?? undefined)),
        takeUntilDestroyed(),
      )
      .subscribe(appendPage);
  }
}
