import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import type { Salon } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SalonCardStore } from './salon-card.store';
import { buildSalonProfilePatch, toSalonProfileFormValue } from './salon-profile-patch';

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
 * Editing the Профіль of a Салон. The limits mirror salon-api's own schema so a typo is caught
 * here, but the backend stays the judge. Sends only what changed, under the `updatedAt` the form
 * was opened with; if the Власник салону got there first, offers to reload instead of overwriting.
 */
@Component({
  selector: 'app-salon-profile-form',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, Textarea, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-profile.form.html',
})
export class SalonProfileForm {
  private readonly store = inject(SalonCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  protected readonly salon = this.store.salon;
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
    bufferMinutes: new FormControl<number | null>(null, wholeNumber(120)),
    bookingForwardDays: new FormControl<number | null>(null, wholeNumber(365)),
    brandColor: text([Validators.pattern(/^\s*(#[0-9a-fA-F]{6})?\s*$/)]),
  });
  protected readonly reason = text([Validators.maxLength(500)]);

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly patch = computed(() => {
    this.value();
    const salon = this.salon();
    return salon ? buildSalonProfilePatch(salon, this.form.getRawValue()) : {};
  });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly canSave = computed(
    () => !this.busy() && !this.conflict() && this.status() === 'VALID' && Object.keys(this.patch()).length > 0,
  );

  constructor() {
    this.resetTo(this.salon());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  /** The saved Салон is the card's — header and every tab included — before the form closes. */
  protected save(): void {
    if (!this.canSave() || this.reason.invalid) {
      return;
    }
    this.busy.set(true);
    this.store.updateProfile(
      { patch: this.patch(), reason: this.reason.value.trim() || undefined },
      {
        next: () => {
          this.messages.add({ severity: 'success', summary: this.i18n.t('salon.edit.saved'), life: 4000 });
          this.closed.emit();
        },
        // Every refusal but this one has already been worded as a toast; the form stays as typed.
        error: (error) => this.conflict.set(error instanceof ApiError && error.code === EDIT_CONFLICT_CODE),
        done: () => this.busy.set(false),
      },
    );
  }

  /** Drops what was typed and reopens the form on what the Власник салону saved meanwhile. */
  protected reload(): void {
    this.busy.set(true);
    this.store.reload({
      next: (fresh) => {
        this.resetTo(fresh);
        this.conflict.set(false);
      },
      done: () => this.busy.set(false),
    });
  }

  private resetTo(salon: Salon | null): void {
    if (salon) {
      this.form.reset(toSalonProfileFormValue(salon));
    }
  }
}
