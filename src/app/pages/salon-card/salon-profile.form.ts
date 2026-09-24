import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import type { Salon } from '../../core/api/salons.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { concurrentEdit } from '../../shared/concurrent-edit';
import { loadedCard } from '../../shared/profile-card/loaded-card';
import { SALON_CARD } from './salon-card';
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
  private readonly card = loadedCard(SALON_CARD);

  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  protected readonly profile = this.card.profile;

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

  /** The saved Салон is the card's — header and every tab included — before the form closes. */
  protected readonly edit = concurrentEdit({
    form: this.form,
    current: this.profile,
    changes: buildSalonProfilePatch,
    save: (patch, reason) => this.card.update({ patch: patch ?? {}, reason }),
    reload: () => this.card.reload(),
    fill: (salon) => this.resetTo(salon),
    saved: () => this.closed.emit(),
  });

  constructor() {
    this.resetTo(this.profile());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  private resetTo(salon: Salon): void {
    this.form.reset(toSalonProfileFormValue(salon));
  }
}
