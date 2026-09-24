import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import type { Master } from '../../core/api/masters.client';
import { MASTER_SPECIALIZATIONS } from '../../core/api/salon-masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { concurrentEdit } from '../../shared/concurrent-edit';
import { loadedCard } from '../../shared/profile-card/loaded-card';
import { specializationLabel } from '../../shared/specialization';
import { MASTER_CARD } from './master-card';
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
  private readonly card = loadedCard(MASTER_CARD);
  private readonly i18n = inject(I18nService);

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
    specialization: text([Validators.required]),
    bufferMinutes: new FormControl<number | null>(null, wholeNumber(120)),
    bookingForwardDays: new FormControl<number | null>(null, wholeNumber(365)),
    brandColor: text([Validators.pattern(/^\s*(#[0-9a-fA-F]{6})?\s*$/)]),
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

  /** The saved Майстер is the card's — header and every tab included — before the form closes. */
  protected readonly edit = concurrentEdit({
    form: this.form,
    current: this.profile,
    changes: buildMasterProfilePatch,
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

  private resetTo(master: Master): void {
    this.form.reset(toMasterProfileFormValue(master));
  }
}
