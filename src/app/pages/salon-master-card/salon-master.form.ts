import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { finalize, type Observable, tap } from 'rxjs';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import {
  MASTER_SPECIALIZATIONS,
  type SalonMaster,
  SalonMastersClient,
} from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { specializationLabel } from '../../shared/specialization';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { buildSalonMasterPatch, toSalonMasterFormValue } from './salon-master-patch';
import { SalonMasterStore } from './salon-master.store';

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
    @if (master(); as master) {
      <form
        class="profile-fields profile-form"
        data-testid="master-form"
        [formGroup]="form"
        (ngSubmit)="save()"
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
          [formControl]="reason"
        />

        <p class="field-wide text-xs text-muted">{{ 'salonMaster.edit.statusHint' | t }}</p>

        @if (conflict()) {
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
                [loading]="busy()"
                (click)="reload()"
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
            [disabled]="!canSave()"
            [loading]="busy() && !conflict()"
          ></button>
          <button
            pButton
            type="button"
            severity="secondary"
            data-testid="edit-cancel"
            [text]="true"
            [label]="'salon.edit.cancel' | t"
            [disabled]="busy()"
            (click)="closed.emit()"
          ></button>
        </div>
      </form>
    }
  `,
})
export class SalonMasterForm {
  private readonly client = inject(SalonMastersClient);
  private readonly store = inject(SalonMasterStore);
  private readonly salon = inject(SalonCardStore).salon.asReadonly();
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  protected readonly master = this.store.master.asReadonly();
  protected readonly busy = signal(false);
  protected readonly conflict = signal(false);

  protected readonly form = new FormGroup({
    specialization: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    commissionPercent: new FormControl<number | null>(
      null,
      numberValidators(0, 100, /^\d+([.,]\d+)?$/),
    ),
    // The backend still accepts the legacy `0` («as the salon»), but nothing should write it anew.
    bookingForwardDays: new FormControl<number | null>(null, numberValidators(1, 365, /^\d+$/)),
  });
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });

  /** The platform's list; a stored value outside it stays selectable so the form opens valid. */
  protected readonly specializationOptions = computed(() => {
    const stored = this.master()?.specialization;
    const values: readonly string[] =
      stored && !MASTER_SPECIALIZATIONS.some((value) => value === stored)
        ? [...MASTER_SPECIALIZATIONS, stored]
        : MASTER_SPECIALIZATIONS;
    return values.map((value) => ({ value, label: specializationLabel(this.i18n, value) }));
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly patch = computed(() => {
    this.value();
    const master = this.master();
    return master ? buildSalonMasterPatch(master, this.form.getRawValue()) : {};
  });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly canSave = computed(
    () =>
      !this.busy() &&
      !this.conflict() &&
      this.status() === 'VALID' &&
      Object.keys(this.patch()).length > 0,
  );

  constructor() {
    this.resetTo(this.master());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  protected save(): void {
    const salon = this.salon();
    const master = this.master();
    if (!salon || !master || !this.canSave() || this.reason.invalid) {
      return;
    }
    this.run(
      this.client.update(salon.salonId, master.masterId, {
        updatedAt: master.updatedAt,
        patch: this.patch(),
        reason: this.reason.value.trim() || undefined,
      }),
    ).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t('salon.edit.saved'),
          life: 4000,
        });
        this.closed.emit();
      },
      // Every refusal but this one has already been worded as a toast; the form stays as typed.
      error: (error: unknown) =>
        this.conflict.set(error instanceof ApiError && error.code === EDIT_CONFLICT_CODE),
    });
  }

  /** Drops what was typed and reopens the form on what the Власник салону saved meanwhile. */
  protected reload(): void {
    const salon = this.salon();
    const master = this.master();
    if (!salon || !master) {
      return;
    }
    this.run(this.client.get(salon.salonId, master.masterId)).subscribe({
      next: (fresh) => {
        this.resetTo(fresh);
        this.conflict.set(false);
      },
      error: () => undefined,
    });
  }

  /** The card shows whatever the backend answered with — header and every tab included. */
  private run(request: Observable<SalonMaster>): Observable<SalonMaster> {
    this.busy.set(true);
    return request.pipe(
      tap((master) => this.store.master.set(master)),
      finalize(() => this.busy.set(false)),
    );
  }

  private resetTo(master: SalonMaster | null): void {
    if (master) {
      this.form.reset(toSalonMasterFormValue(master));
    }
  }
}
