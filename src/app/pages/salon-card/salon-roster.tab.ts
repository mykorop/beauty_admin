import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Tag } from 'primeng/tag';
import {
  SALON_MASTER_STATUS_SEVERITY,
  type SalonMaster,
  SalonMastersClient,
} from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatRating } from '../../shared/rating';
import { specializationLabel } from '../../shared/specialization';
import { SalonCardStore } from './salon-card.store';

/**
 * Ростер: everyone linked to the Салон, ended collaborations included. Read-only by design — a
 * master gets here by accepting an Інвайт and by nothing else, so there is no «add» on this tab.
 */
@Component({
  selector: 'app-salon-roster-tab',
  imports: [RouterLink, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows(); as rows) {
      <table class="w-full max-w-6xl rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b border-slate-200">
            <th class="px-4 py-3 font-normal">{{ 'roster.column.master' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'master.field.specialization' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'roster.column.status' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'master.field.commissionPercent' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'salon.field.rating' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'master.field.joinedAt' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.master.masterId) {
            <tr class="border-b border-slate-100 last:border-0" data-testid="roster-row">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  @if (row.master.masterAvatar) {
                    <img
                      class="size-9 rounded-full object-cover"
                      alt=""
                      data-testid="roster-avatar"
                      [src]="row.master.masterAvatar"
                    />
                  } @else {
                    <span
                      class="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                      aria-hidden="true"
                      ><i class="pi pi-user"></i
                    ></span>
                  }
                  <div>
                    <a
                      class="font-medium hover:underline"
                      data-testid="roster-name"
                      [routerLink]="['/salons', salonId, 'masters', row.master.masterId]"
                      >{{ row.master.masterName || '—' }}</a
                    >
                    @if (row.master.isOwner) {
                      <p-tag
                        class="ml-2"
                        severity="info"
                        data-testid="roster-owner"
                        [value]="'roster.ownerMaster' | t"
                      />
                    }
                    <div class="text-xs text-slate-500">{{ row.master.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">{{ row.specialization }}</td>
              <td class="px-4 py-3">
                <p-tag data-testid="roster-status" [severity]="row.statusSeverity" [value]="row.statusKey | t" />
              </td>
              <td class="px-4 py-3">{{ row.master.commissionPercent }}%</td>
              <td class="px-4 py-3">
                <span data-testid="roster-rating">{{ row.rating }}</span>
                @if (row.master.reviewCount > 0) {
                  <span class="text-slate-500">
                    · {{ 'salon.value.reviews' | t: { count: row.master.reviewCount } }}</span
                  >
                }
              </td>
              <td class="px-4 py-3">{{ row.joinedAt }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="py-8 text-center text-slate-600" data-testid="roster-empty">
                {{ 'roster.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
      <p class="mt-2 text-xs text-slate-500" data-testid="roster-invite-only">
        {{ 'roster.inviteOnly' | t }}
      </p>
    } @else if (failed()) {
      <p class="text-slate-600" data-testid="roster-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonRosterTab {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(SalonCardStore);

  protected readonly salonId = this.store.salon()?.salonId ?? '';
  private readonly masters = signal<SalonMaster[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    return (
      this.masters()?.map((master) => ({
        master,
        specialization: specializationLabel(this.i18n, master.specialization),
        statusKey: `roster.status.${master.status}` satisfies TranslationKey,
        statusSeverity: SALON_MASTER_STATUS_SEVERITY[master.status] ?? 'secondary',
        rating: formatRating(locale, master.rating, master.reviewCount),
        joinedAt: this.store.venueDay(master.joinedAt),
      })) ?? null
    );
  });

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    if (this.salonId) {
      inject(SalonMastersClient)
        .roster(this.salonId)
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (roster) => this.masters.set(roster.items),
          // The interceptor has already worded the refusal as a toast.
          error: () => this.failed.set(true),
        });
    }
  }
}
