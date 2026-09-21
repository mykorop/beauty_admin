import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatRating } from '../../shared/rating';
import { specializationLabel } from '../../shared/specialization';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterForm } from './salon-master.form';
import { SalonMasterStore } from './salon-master.store';

/**
 * Профіль of a Майстер салону — the data of his link to the Салон: read first, edited on demand,
 * never inside a Видалений salon. The link's status is shown and never edited here: a collaboration
 * starts with an Інвайт and ends with removal from the Ростер.
 */
@Component({
  selector: 'app-salon-master-profile-tab',
  imports: [ButtonDirective, SalonMasterForm, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing()) {
      <app-salon-master-form (closed)="editing.set(false)" />
    } @else if (master(); as master) {
      @if (salon()?.status !== 'deleted') {
        <div class="mb-3 flex max-w-4xl justify-end">
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-pencil"
            data-testid="master-edit"
            [label]="'salon.edit.open' | t"
            (click)="editing.set(true)"
          ></button>
        </div>
      }
      <dl
        class="grid max-w-4xl grid-cols-[14rem_1fr] gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm"
      >
        <dt class="text-slate-500">{{ 'master.field.name' | t }}</dt>
        <dd class="flex items-center gap-3" data-testid="field-name">
          @if (master.masterAvatar) {
            <img class="size-10 rounded-full object-cover" alt="" [src]="master.masterAvatar" />
          }
          {{ master.masterName || '—' }}
        </dd>

        <dt class="text-slate-500">{{ 'master.field.email' | t }}</dt>
        <dd data-testid="field-email">{{ master.email || '—' }}</dd>

        <dt class="text-slate-500">{{ 'master.field.specialization' | t }}</dt>
        <dd data-testid="field-specialization">{{ specialization() }}</dd>

        <dt class="text-slate-500">{{ 'master.field.status' | t }}</dt>
        <dd data-testid="field-status">{{ statusKey() | t }}</dd>

        <dt class="text-slate-500">{{ 'master.field.commissionPercent' | t }}</dt>
        <dd data-testid="field-commission">{{ master.commissionPercent }}%</dd>

        <dt class="text-slate-500">{{ 'master.field.bookingHorizon' | t }}</dt>
        <dd data-testid="field-bookingHorizon">
          {{ 'salon.value.days' | t: { count: master.bookingForwardDays } }}
        </dd>

        <dt class="text-slate-500">{{ 'salon.field.rating' | t }}</dt>
        <dd data-testid="field-rating">
          {{ rating() }} · {{ 'salon.value.reviews' | t: { count: master.reviewCount } }}
        </dd>

        <dt class="text-slate-500">{{ 'master.field.joinedAt' | t }}</dt>
        <dd data-testid="field-joinedAt">{{ joinedAt() }}</dd>

        <dt class="text-slate-500">{{ 'salon.field.updatedAt' | t }}</dt>
        <dd data-testid="field-updatedAt">{{ updatedAt() }}</dd>
      </dl>
      @if (salon(); as salon) {
        <p class="mt-2 text-xs text-slate-500">
          {{ 'salon.datesInVenueZone' | t: { timezone: salon.timezone } }}
        </p>
      }
    }
  `,
})
export class SalonMasterProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly salonStore = inject(SalonCardStore);

  protected readonly salon = this.salonStore.salon.asReadonly();
  protected readonly master = inject(SalonMasterStore).master.asReadonly();
  protected readonly editing = signal(false);

  protected readonly specialization = computed(() =>
    specializationLabel(this.i18n, this.master()?.specialization ?? ''),
  );
  protected readonly statusKey = computed<TranslationKey>(() => `roster.status.${this.master()?.status ?? 'ACTIVE'}`);
  protected readonly rating = computed(() => {
    const master = this.master();
    return master ? formatRating(this.i18n.locale(), master.rating, master.reviewCount) : '—';
  });
  protected readonly joinedAt = computed(() => this.salonStore.venueDay(this.master()?.joinedAt));
  protected readonly updatedAt = computed(() => this.salonStore.venueDate(this.master()?.updatedAt));
}
