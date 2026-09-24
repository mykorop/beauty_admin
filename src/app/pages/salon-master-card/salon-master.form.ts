import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { MASTER_SPECIALIZATIONS, type SalonMaster } from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { concurrentEdit } from '../../shared/concurrent-edit';
import { loadedCard } from '../../shared/profile-card/loaded-card';
import { specializationLabel } from '../../shared/specialization';
import { buildSalonMasterPatch, toSalonMasterFormValue } from './salon-master-patch';
import { SALON_MASTER_CARD } from './salon-master-card';

const numberValidators = (min: number, max: number, pattern: RegExp): ValidatorFn[] => [
  Validators.required,
  Validators.min(min),
  Validators.max(max),
  Validators.pattern(pattern),
];

/**
 * Editing the link of a Майстер салону: спеціалізація, комісія, горизонт бронювання — and nothing
 * else; there is no status control here. Sends only what changed, under the `updatedAt` the form
 * was opened with (`null` for a link nobody edited yet); if the Власник салону got there first,
 * offers to reload instead of overwriting.
 */
@Component({
  selector: 'app-salon-master-form',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="profile-fields profile-form"
      data-testid="master-form"
      [formGroup]="form"
      (ngSubmit)="edit.save()"
    >
      <label class="pt-2 text-muted" for="edit-specialization">{{
        'master.field.specialization' | t
      }}</label>
      <p-select
        inputId="edit-specialization"
        data-testid="edit-specialization"
        formControlName="specialization"
        optionLabel="label"
        optionValue="value"
        [options]="specializationOptions()"
      />

      <label class="pt-2 text-muted" for="edit-commissionPercent">{{
        'master.field.commissionPercent' | t
      }}</label>
      <input
        pInputText
        id="edit-commissionPercent"
        data-testid="edit-commissionPercent"
        type="number"
        min="0"
        max="100"
        step="any"
        formControlName="commissionPercent"
        [invalid]="invalid('commissionPercent')"
        [attr.aria-invalid]="invalid('commissionPercent')"
      />

      <label class="pt-2 text-muted" for="edit-bookingForwardDays">{{
        'master.field.bookingHorizon' | t
      }}</label>
      <input
        pInputText
        id="edit-bookingForwardDays"
        data-testid="edit-bookingForwardDays"
        type="number"
        min="1"
        max="365"
        step="1"
        formControlName="bookingForwardDays"
        [invalid]="invalid('bookingForwardDays')"
        [attr.aria-invalid]="invalid('bookingForwardDays')"
      />

      <label class="pt-2 text-muted" for="edit-reason">{{ 'salon.edit.reason' | t }}</label>
      <input
        pInputText
        id="edit-reason"
        data-testid="edit-reason"
        maxlength="500"
        [formControl]="edit.reason"
      />

      <p class="field-wide text-xs text-muted">{{ 'salonMaster.edit.statusHint' | t }}</p>

      @if (edit.conflict()) {
        <p-message
          class="field-wide"
          severity="warn"
          icon="pi pi-exclamation-triangle"
          data-testid="edit-conflict"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span>{{ 'salon.edit.conflict' | t }}</span>
            <button
              pButton
              type="button"
              size="small"
              severity="warn"
              data-testid="edit-reload"
              [label]="'salon.edit.reload' | t"
              [loading]="edit.busy()"
              (click)="edit.reload()"
            ></button>
          </div>
        </p-message>
      }

      <div class="field-wide flex gap-2 pt-2">
        <button
          pButton
          type="submit"
          data-testid="edit-save"
          [label]="'salon.edit.save' | t"
          [disabled]="!edit.canSave()"
          [loading]="edit.busy() && !edit.conflict()"
        ></button>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="edit-cancel"
          [text]="true"
          [label]="'salon.edit.cancel' | t"
          [disabled]="edit.busy()"
          (click)="closed.emit()"
        ></button>
      </div>
    </form>
  `,
})
export class SalonMasterForm {
  private readonly card = loadedCard(SALON_MASTER_CARD);
  private readonly i18n = inject(I18nService);

  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  protected readonly profile = this.card.profile;

  protected readonly form = new FormGroup({
    specialization: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    commissionPercent: new FormControl<number | null>(
      null,
      numberValidators(0, 100, /^\d+([.,]\d+)?$/),
    ),
    // The backend still accepts the legacy `0` («as the salon»), but nothing should write it anew.
    bookingForwardDays: new FormControl<number | null>(null, numberValidators(1, 365, /^\d+$/)),
  });

  /** The platform's list; a stored value outside it stays selectable so the form opens valid. */
  protected readonly specializationOptions = computed(() => {
    const stored = this.profile().specialization;
    const values: readonly string[] =
      stored && !MASTER_SPECIALIZATIONS.some((value) => value === stored)
        ? [...MASTER_SPECIALIZATIONS, stored]
        : MASTER_SPECIALIZATIONS;
    return values.map((value) => ({ value, label: specializationLabel(this.i18n, value) }));
  });

  /** The saved link is the card's — header and every tab included — before the form closes. */
  protected readonly edit = concurrentEdit({
    form: this.form,
    current: this.profile,
    changes: buildSalonMasterPatch,
    save: (patch, reason) => this.card.update({ patch: patch ?? {}, reason }),
    reload: () => this.card.reload(),
    fill: (master) => this.resetTo(master),
    saved: () => this.closed.emit(),
  });

  constructor() {
    this.resetTo(this.profile());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  private resetTo(master: SalonMaster): void {
    this.form.reset(toSalonMasterFormValue(master));
  }
}
