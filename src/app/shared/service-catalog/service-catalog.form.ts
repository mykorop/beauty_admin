import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import type { Dictionaries } from '../../core/api/dictionaries.client';
import { ServiceCatalogClient } from '../../core/api/service-catalog.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { concurrentEdit } from '../concurrent-edit';
import { cardScope } from '../profile-card/loaded-card';
import { serviceCategoryLabel } from '../service-category';
import {
  buildCatalogServicePatch,
  EMPTY_CATALOG_SERVICE_FORM_VALUE,
  toCatalogServiceFields,
  toCatalogServiceFormValue,
  touchesMasterOwnedFields,
} from './service-catalog-patch';
import type { CatalogService } from './service-catalog.model';

const numberValidators = (min: number, max: number): ValidatorFn[] => [
  Validators.required,
  Validators.min(min),
  Validators.max(max),
  Validators.pattern(/^\d+$/),
];

/** A stored value outside the platform's list stays selectable, so the form opens valid. */
const withStored = (values: readonly string[], stored: string | undefined): readonly string[] =>
  stored && !values.includes(stored) ? [...values, stored] : values;

/**
 * One послуга of a Каталог: a new one (MDL only) or an existing one, of which only the changed
 * fields are sent, under the `updatedAt` the form was opened with.
 *
 * Whose Каталог it writes is the card's scope. The one thing that differs between a Салон's and a
 * Незалежний майстер's is `copies`: in a Салон, ціна and тривалість are the
 * starting point for Копії майстрів that never follow, and the form says so the moment either is
 * touched; a Незалежний майстер has no Копії, so the warning would name nothing.
 */
@Component({
  selector: 'app-service-catalog-form',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputText,
    Message,
    Select,
    Textarea,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="profile-fields profile-form"
      data-testid="service-form"
      [formGroup]="form"
      (ngSubmit)="edit.save()"
    >
      <h2 class="field-wide text-base font-medium" data-testid="service-form-title">
        {{ (current() ? 'services.form.editTitle' : 'services.form.newTitle') | t }}
      </h2>

      <label class="pt-2 text-muted" for="service-name">{{ 'services.field.name' | t }}</label>
      <input
        pInputText
        id="service-name"
        data-testid="service-name"
        maxlength="200"
        formControlName="name"
        [invalid]="invalid('name')"
        [attr.aria-invalid]="invalid('name')"
      />

      <label class="pt-2 text-muted" for="service-description">{{
        'services.field.description' | t
      }}</label>
      <textarea
        pTextarea
        id="service-description"
        data-testid="service-description"
        rows="3"
        maxlength="2000"
        formControlName="description"
      ></textarea>

      <label class="pt-2 text-muted" for="service-category">{{
        'services.field.category' | t
      }}</label>
      <p-select
        inputId="service-category"
        data-testid="service-category"
        formControlName="category"
        optionLabel="label"
        optionValue="value"
        [filter]="true"
        [options]="categoryOptions()"
        [placeholder]="'services.field.categoryPlaceholder' | t"
      />

      <label class="pt-2 text-muted" for="service-duration">{{
        'services.field.durationMinutes' | t
      }}</label>
      <input
        pInputText
        id="service-duration"
        data-testid="service-duration"
        type="number"
        min="1"
        max="720"
        step="1"
        formControlName="durationMinutes"
        [invalid]="invalid('durationMinutes')"
        [attr.aria-invalid]="invalid('durationMinutes')"
      />

      <label class="pt-2 text-muted" for="service-price">{{ 'services.field.price' | t }}</label>
      <div class="flex gap-2">
        <input
          pInputText
          class="flex-1"
          id="service-price"
          data-testid="service-price"
          type="number"
          min="0"
          step="1"
          formControlName="price"
          [invalid]="invalid('price')"
          [attr.aria-invalid]="invalid('price')"
        />
        <p-select
          inputId="service-currency"
          data-testid="service-currency"
          formControlName="currency"
          [options]="currencyOptions()"
          [ariaLabel]="'services.field.currency' | t"
        />
      </div>
      @if (current()?.priceUnit === 'PER_HOUR') {
        <p class="field-hint text-xs text-muted">{{ 'services.form.perHourHint' | t }}</p>
      }
      @if (!current()) {
        <p class="field-hint text-xs text-muted" data-testid="service-mdl-only">
          {{ 'services.form.mdlOnly' | t }}
        </p>
      }

      <label class="pt-2 text-muted" for="service-active">{{
        'services.field.isActive' | t
      }}</label>
      <p-checkbox
        inputId="service-active"
        data-testid="service-active"
        formControlName="isActive"
        [binary]="true"
      />

      <label class="pt-2 text-muted" for="service-reason">{{ 'salon.edit.reason' | t }}</label>
      <input
        pInputText
        id="service-reason"
        data-testid="service-reason"
        maxlength="500"
        [formControl]="edit.reason"
      />

      @if (warnsAboutCopies()) {
        <p-message
          class="field-wide"
          severity="warn"
          icon="pi pi-exclamation-triangle"
          data-testid="service-copies-warning"
        >
          {{ 'services.form.copiesWarning' | t: { count: current()?.masterCopyCount ?? 0 } }}
        </p-message>
      }

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
          data-testid="service-save"
          [label]="'salon.edit.save' | t"
          [disabled]="!edit.canSave()"
          [loading]="edit.busy() && !edit.conflict()"
        ></button>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="service-cancel"
          [text]="true"
          [label]="'salon.edit.cancel' | t"
          [disabled]="edit.busy()"
          (click)="closed.emit(null)"
        ></button>
      </div>
    </form>
  `,
})
export class ServiceCatalogForm implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly catalog = inject(ServiceCatalogClient);
  /** Whose Каталог this is. */
  private readonly scope = cardScope();
  /** The service to edit; `null` opens the form on a new one. */
  readonly service = input.required<CatalogService | null>();
  readonly dictionaries = input.required<Dictionaries>();
  /** Копії майстрів can exist in this Каталог, so a new ціна or тривалість is worth warning about. */
  readonly copies = input(false);

  /** The saved service, or `null` when cancelled — either way the tab goes back to the table. */
  readonly closed = output<CatalogService | null>();

  /** What the form is open on: the input, until a conflict reload brings a fresher one. */
  protected readonly current = signal<CatalogService | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    durationMinutes: new FormControl<number | null>(null, numberValidators(1, 720)),
    price: new FormControl<number | null>(null, numberValidators(0, Number.MAX_SAFE_INTEGER)),
    currency: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  protected readonly categoryOptions = computed(() =>
    withStored(this.dictionaries().serviceCategories, this.current()?.category)
      .map((value) => ({ value, label: serviceCategoryLabel(this.i18n, value) }))
      .sort((left, right) => left.label.localeCompare(right.label, this.i18n.locale())),
  );
  protected readonly currencyOptions = computed(() => [
    ...withStored(this.dictionaries().serviceCurrencies, this.current()?.currency),
  ]);

  /** Updated in place, or created — in the Каталог of the card's profile. */
  protected readonly edit = concurrentEdit({
    form: this.form,
    current: this.current,
    changes: buildCatalogServicePatch,
    save: (patch, reason) => {
      const service = this.current();
      if (service) {
        return this.catalog.update(this.scope(), service.serviceId, {
          updatedAt: service.updatedAt,
          patch: patch ?? {},
          reason,
        });
      }
      const fields = toCatalogServiceFields(this.form.getRawValue());
      return fields && this.catalog.create(this.scope(), { fields, reason });
    },
    reload: (service) => this.catalog.get(this.scope(), service.serviceId),
    fill: (service) => this.resetTo(service),
    saved: (service) => this.closed.emit(service),
  });

  protected readonly warnsAboutCopies = computed(() => {
    const patch = this.edit.changes();
    return this.copies() && !!patch && touchesMasterOwnedFields(patch);
  });

  ngOnInit(): void {
    this.resetTo(this.service());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  private resetTo(service: CatalogService | null): void {
    this.current.set(service);
    // The currency decides how the stored price reads, and a Копія keeps its own: switching it on an
    // existing service would re-denominate a number nobody re-typed. It is chosen once, on creation.
    this.form.controls.currency[service ? 'disable' : 'enable']();
    this.form.reset(
      service ? toCatalogServiceFormValue(service) : EMPTY_CATALOG_SERVICE_FORM_VALUE,
    );
  }
}
