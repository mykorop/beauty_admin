import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { finalize } from 'rxjs';
import { SalonMastersClient } from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatRating } from '../../shared/rating';
import { ReasonDialog } from '../../shared/reason-dialog/reason-dialog';
import { specializationLabel } from '../../shared/specialization';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterForm } from './salon-master.form';
import { SalonMasterStore } from './salon-master.store';

/**
 * Профіль of a Майстер салону — the data of his link to the Салон: read first, edited on demand,
 * never inside a Видалений salon. The link's status is shown and never edited here: a collaboration
 * starts with an Інвайт and ends with removal from the Ростер — which is offered here, in a
 * Видалений salon too (that is where masters get stranded), and never for the Власник-майстер.
 */
@Component({
  selector: 'app-salon-master-profile-tab',
  imports: [ButtonDirective, ReasonDialog, SalonMasterForm, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing()) {
      <app-salon-master-form (closed)="editing.set(false)" />
    } @else if (master(); as master) {
      <div class="mb-3 flex flex-wrap max-w-4xl justify-end gap-2">
        @if (canRemove()) {
          <button
            pButton
            type="button"
            size="small"
            severity="danger"
            icon="pi pi-user-minus"
            data-testid="master-remove"
            [outlined]="true"
            [label]="'salonMaster.remove.open' | t"
            (click)="removing.set(true)"
          ></button>
        }
        @if (salon()?.status !== 'deleted') {
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-pencil"
            data-testid="master-edit"
            [label]="'salon.edit.open' | t"
            (click)="editing.set(true)"
          ></button>
        }
      </div>
      <app-reason-dialog
        titleKey="salonMaster.remove.title"
        confirmLabelKey="salonMaster.remove.confirm"
        [busy]="busy()"
        [(visible)]="removing"
        (confirmed)="remove($event)"
      >
        {{
          'salonMaster.remove.message'
            | t: { master: master.masterName, salon: salon()?.name ?? '' }
        }}
      </app-reason-dialog>
      <dl class="profile-fields">
        <dt class="text-muted">{{ 'master.field.name' | t }}</dt>
        <dd class="flex items-center gap-3" data-testid="field-name">
          @if (master.masterAvatar) {
            <img class="size-10 rounded-full object-cover" alt="" [src]="master.masterAvatar" />
          }
          {{ master.masterName || '—' }}
        </dd>

        <dt class="text-muted">{{ 'master.field.email' | t }}</dt>
        <dd data-testid="field-email">{{ master.email || '—' }}</dd>

        <dt class="text-muted">{{ 'master.field.specialization' | t }}</dt>
        <dd data-testid="field-specialization">{{ specialization() }}</dd>

        <dt class="text-muted">{{ 'master.field.status' | t }}</dt>
        <dd data-testid="field-status">{{ statusKey() | t }}</dd>

        <dt class="text-muted">{{ 'master.field.commissionPercent' | t }}</dt>
        <dd data-testid="field-commission">{{ master.commissionPercent }}%</dd>

        <dt class="text-muted">{{ 'master.field.bookingHorizon' | t }}</dt>
        <dd data-testid="field-bookingHorizon">
          {{ 'salon.value.days' | t: { count: master.bookingForwardDays } }}
        </dd>

        <dt class="text-muted">{{ 'salon.field.rating' | t }}</dt>
        <dd data-testid="field-rating">
          {{ rating() }} · {{ 'salon.value.reviews' | t: { count: master.reviewCount } }}
        </dd>

        <dt class="text-muted">{{ 'master.field.joinedAt' | t }}</dt>
        <dd data-testid="field-joinedAt">{{ joinedAt() }}</dd>

        <dt class="text-muted">{{ 'salon.field.updatedAt' | t }}</dt>
        <dd data-testid="field-updatedAt">{{ updatedAt() }}</dd>
      </dl>
      @if (salon(); as salon) {
        <p class="mt-2 text-xs text-muted">
          {{ 'salon.datesInVenueZone' | t: { timezone: salon.timezone } }}
        </p>
      }
    }
  `,
})
export class SalonMasterProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly salonStore = inject(SalonCardStore);
  private readonly store = inject(SalonMasterStore);
  private readonly client = inject(SalonMastersClient);
  private readonly messages = inject(MessageService);

  protected readonly salon = this.salonStore.salon.asReadonly();
  protected readonly master = this.store.master.asReadonly();
  protected readonly editing = signal(false);
  protected readonly removing = signal(false);
  protected readonly busy = signal(false);

  /** The backend refuses both as well: `OWNER_MASTER_PROTECTED`, and `NOT_FOUND` for an ended link. */
  protected readonly canRemove = computed(() => {
    const master = this.master();
    return !!master && !master.isOwner && master.status !== 'INACTIVE';
  });

  protected readonly specialization = computed(() =>
    specializationLabel(this.i18n, this.master()?.specialization ?? ''),
  );
  protected readonly statusKey = computed<TranslationKey>(
    () => `roster.status.${this.master()?.status ?? 'ACTIVE'}`,
  );
  protected readonly rating = computed(() => {
    const master = this.master();
    return master ? formatRating(this.i18n.locale(), master.rating, master.reviewCount) : '—';
  });
  protected readonly joinedAt = computed(() => this.salonStore.venueDay(this.master()?.joinedAt));
  protected readonly updatedAt = computed(() =>
    this.salonStore.venueDate(this.master()?.updatedAt),
  );

  protected remove(reason: string): void {
    const salon = this.salon();
    const master = this.master();
    if (!salon || !master || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.client
      .remove(salon.salonId, master.masterId, reason)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ status }) => {
          // The link stays on the Ростер as an ended one, so the card stays open on it.
          this.store.master.set({ ...master, status });
          this.removing.set(false);
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t('salonMaster.remove.done'),
            life: 4000,
          });
        },
        // Already worded as a toast; the dialog stays open with the reason as typed.
        error: () => undefined,
      });
  }
}
