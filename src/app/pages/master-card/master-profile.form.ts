import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize, type Observable, tap } from 'rxjs';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import { type Master, MastersClient } from '../../core/api/masters.client';
import { MASTER_SPECIALIZATIONS } from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { specializationLabel } from '../../shared/specialization';
import { MasterCardStore } from './master-card.store';
import { buildMasterProfilePatch, toMasterProfileFormValue } from './master-profile-patch';

/** The backend strips these before matching, so the form lets the administrator type them. */
const phoneValidator: ValidatorFn = (control) =>
  /^\+?[1-9]\d{1,14}$/.test(String(control.value ?? '').replace(/[\s\-().]/g, '')) ? null : { phone: true };

const wholeNumber = (max: number): ValidatorFn[] => [
  Validators.required,
  Validators.min(0),
  Validators.max(max),
  Validators.pattern(/^\d+$/),
];

const text = (validators: ValidatorFn[]) => new FormControl('', { nonNullable: true, validators });

/**
 * Editing the Профіль of a Незалежний майстер — the same form as a Салон's, field for field, with
 * спеціалізація in place of the fields a Салон alone has. The limits mirror master-api's own
 * schema so a typo is caught here, but the backend stays the judge. Sends only what changed, under
 * the `updatedAt` the form was opened with; if the Майстер got there first, offers to reload
 * instead of overwriting.
 */
@Component({
  selector: 'app-master-profile-form',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, Select, Textarea, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-profile.form.html',
})
export class MasterProfileForm {
  private readonly client = inject(MastersClient);
  private readonly store = inject(MasterCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  protected readonly master = this.store.master.asReadonly();
  protected readonly busy = signal(false);
  protected readonly conflict = signal(false);

  protected readonly form = new FormGroup({
    name: text([Validators.required, Validators.maxLength(200)]),
    description: text([Validators.maxLength(2000)]),
    addressStreet: text([Validators.required, Validators.maxLength(200)]),
    addressHouseNumber: text([Validators.required, Validators.maxLength(30)]),
    addressCityCode: text([Validators.required, Validators.pattern(/^\d{7}$/)]),
    addressZipCode: text([Validators.required, Validators.pattern(/^MD-\d{4}$/)]),
    phone: text([phoneValidator]),
    specialization: text([Validators.required]),
    bufferMinutes: new FormControl<number | null>(null, wholeNumber(120)),
    bookingForwardDays: new FormControl<number | null>(null, wholeNumber(365)),
    brandColor: text([Validators.pattern(/^\s*(#[0-9a-fA-F]{6})?\s*$/)]),
  });
  protected readonly reason = text([Validators.maxLength(500)]);

  /** The platform's list; a stored value outside it stays selectable so the form opens valid. */
  protected readonly specializationOptions = computed(() => {
    const stored = this.master()?.specialization;
    const values: readonly string[] =
      stored && !MASTER_SPECIALIZATIONS.some((value) => value === stored)
        ? [...MASTER_SPECIALIZATIONS, stored]
        : MASTER_SPECIALIZATIONS;
    return values.map((value) => ({ value, label: specializationLabel(this.i18n, value) }));
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly patch = computed(() => {
    this.value();
    const master = this.master();
    return master ? buildMasterProfilePatch(master, this.form.getRawValue()) : {};
  });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly canSave = computed(
    () => !this.busy() && !this.conflict() && this.status() === 'VALID' && Object.keys(this.patch()).length > 0,
  );

  constructor() {
    this.resetTo(this.master());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  protected save(): void {
    const master = this.master();
    if (!master || !this.canSave() || this.reason.invalid) {
      return;
    }
    this.run(
      this.client.updateProfile(master.masterId, {
        updatedAt: master.updatedAt,
        patch: this.patch(),
        reason: this.reason.value.trim() || undefined,
      }),
    ).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: this.i18n.t('salon.edit.saved'), life: 4000 });
        this.closed.emit();
      },
      // Every refusal but this one has already been worded as a toast; the form stays as typed.
      error: (error: unknown) => this.conflict.set(error instanceof ApiError && error.code === EDIT_CONFLICT_CODE),
    });
  }

  /** Drops what was typed and reopens the form on what the Майстер saved meanwhile. */
  protected reload(): void {
    const master = this.master();
    if (!master) {
      return;
    }
    this.run(this.client.get(master.masterId)).subscribe({
      next: (fresh) => {
        this.resetTo(fresh);
        this.conflict.set(false);
      },
      error: () => undefined,
    });
  }

  /** The card shows whatever the backend answered with — header and every tab included. */
  private run(request: Observable<Master>): Observable<Master> {
    this.busy.set(true);
    return request.pipe(
      tap((master) => this.store.master.set(master)),
      finalize(() => this.busy.set(false)),
    );
  }

  private resetTo(master: Master | null): void {
    if (master) {
      this.form.reset(toMasterProfileFormValue(master));
    }
  }
}
