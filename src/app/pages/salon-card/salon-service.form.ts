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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, type ValidatorFn, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import { type Dictionaries, type SalonService, SalonServicesClient } from '../../core/api/salon-services.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { serviceCategoryLabel } from '../../shared/service-category';
import {
  buildSalonServicePatch,
  EMPTY_SALON_SERVICE_FORM_VALUE,
  touchesMasterOwnedFields,
  toSalonServiceFields,
  toSalonServiceFormValue,
} from './salon-service-patch';

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
 * One послуга of the Каталог: a new one (MDL only) or an existing one, of which only the changed
 * fields are sent, under the `updatedAt` the form was opened with. The moment ціна or тривалість
 * differs from the stored one it warns that the Копії майстрів stay as they are.
 */
@Component({
  selector: 'app-salon-service-form',
  imports: [ReactiveFormsModule, ButtonDirective, Checkbox, InputText, Message, Select, Textarea, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="grid max-w-4xl grid-cols-[14rem_1fr] items-start gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm"
      data-testid="service-form"
      [formGroup]="form"
      (ngSubmit)="save()"
    >
      <h2 class="col-span-2 text-base font-medium" data-testid="service-form-title">
        {{ (current() ? 'services.form.editTitle' : 'services.form.newTitle') | t }}
      </h2>

      <label class="pt-2 text-slate-500" for="service-name">{{ 'services.field.name' | t }}</label>
      <input
        pInputText
        id="service-name"
        data-testid="service-name"
        maxlength="200"
        formControlName="name"
        [invalid]="invalid('name')"
      />

      <label class="pt-2 text-slate-500" for="service-description">{{ 'services.field.description' | t }}</label>
      <textarea
        pTextarea
        id="service-description"
        data-testid="service-description"
        rows="3"
        maxlength="2000"
        formControlName="description"
      ></textarea>

      <label class="pt-2 text-slate-500" for="service-category">{{ 'services.field.category' | t }}</label>
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

      <label class="pt-2 text-slate-500" for="service-duration">{{ 'services.field.durationMinutes' | t }}</label>
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
      />

      <label class="pt-2 text-slate-500" for="service-price">{{ 'services.field.price' | t }}</label>
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
        <p class="col-start-2 text-xs text-slate-500">{{ 'services.form.perHourHint' | t }}</p>
      }
      @if (!current()) {
        <p class="col-start-2 text-xs text-slate-500" data-testid="service-mdl-only">
          {{ 'services.form.mdlOnly' | t }}
        </p>
      }

      <label class="pt-2 text-slate-500" for="service-active">{{ 'services.field.isActive' | t }}</label>
      <p-checkbox inputId="service-active" data-testid="service-active" formControlName="isActive" [binary]="true" />

      <label class="pt-2 text-slate-500" for="service-reason">{{ 'salon.edit.reason' | t }}</label>
      <input pInputText id="service-reason" data-testid="service-reason" maxlength="500" [formControl]="reason" />

      @if (warnsAboutCopies()) {
        <p-message
          class="col-span-2"
          severity="warn"
          icon="pi pi-exclamation-triangle"
          data-testid="service-copies-warning"
        >
          {{ 'services.form.copiesWarning' | t: { count: current()?.masterCopyCount ?? 0 } }}
        </p-message>
      }

      @if (conflict()) {
        <p-message class="col-span-2" severity="warn" icon="pi pi-exclamation-triangle" data-testid="edit-conflict">
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

      <div class="col-span-2 flex gap-2 pt-2">
        <button
          pButton
          type="submit"
          data-testid="service-save"
          [label]="'salon.edit.save' | t"
          [disabled]="!canSave()"
          [loading]="busy() && !conflict()"
        ></button>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="service-cancel"
          [text]="true"
          [label]="'salon.edit.cancel' | t"
          [disabled]="busy()"
          (click)="closed.emit(null)"
        ></button>
      </div>
    </form>
  `,
})
export class SalonServiceForm implements OnInit {
  private readonly client = inject(SalonServicesClient);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  readonly salonId = input.required<string>();
  /** The service to edit; `null` opens the form on a new one. */
  readonly service = input.required<SalonService | null>();
  readonly dictionaries = input.required<Dictionaries>();

  /** The saved service, or `null` when cancelled — either way the tab goes back to the table. */
  readonly closed = output<SalonService | null>();

  /** What the form is open on: the input, until a conflict reload brings a fresher one. */
  protected readonly current = signal<SalonService | null>(null);
  protected readonly busy = signal(false);
  protected readonly conflict = signal(false);

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
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });

  protected readonly categoryOptions = computed(() =>
    withStored(this.dictionaries().serviceCategories, this.current()?.category)
      .map((value) => ({ value, label: serviceCategoryLabel(this.i18n, value) }))
      .sort((left, right) => left.label.localeCompare(right.label, this.i18n.locale())),
  );
  protected readonly currencyOptions = computed(() => [
    ...withStored(this.dictionaries().serviceCurrencies, this.current()?.currency),
  ]);

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly patch = computed(() => {
    this.value();
    const service = this.current();
    return service ? buildSalonServicePatch(service, this.form.getRawValue()) : null;
  });

  protected readonly warnsAboutCopies = computed(() => {
    const patch = this.patch();
    return !!patch && touchesMasterOwnedFields(patch);
  });

  protected readonly canSave = computed(() => {
    const patch = this.patch();
    return (
      !this.busy() && !this.conflict() && this.status() === 'VALID' && (patch === null || Object.keys(patch).length > 0)
    );
  });

  ngOnInit(): void {
    this.resetTo(this.service());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  protected save(): void {
    if (!this.canSave() || this.reason.invalid) {
      return;
    }
    const service = this.current();
    const reason = this.reason.value.trim() || undefined;
    const fields = toSalonServiceFields(this.form.getRawValue());
    const request = service
      ? this.client.update(this.salonId(), service.serviceId, {
          updatedAt: service.updatedAt,
          patch: this.patch() ?? {},
          reason,
        })
      : fields && this.client.create(this.salonId(), { fields, reason });
    if (!request) {
      return;
    }
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (saved) => {
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t('salon.edit.saved'),
          life: 4000,
        });
        this.closed.emit(saved);
      },
      // Every refusal but this one has already been worded as a toast; the form stays as typed.
      error: (error: unknown) => this.conflict.set(error instanceof ApiError && error.code === EDIT_CONFLICT_CODE),
    });
  }

  /** Drops what was typed and reopens the form on what the Власник салону saved meanwhile. */
  protected reload(): void {
    const service = this.current();
    if (!service) {
      return;
    }
    this.busy.set(true);
    this.client
      .get(this.salonId(), service.serviceId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (fresh) => {
          this.resetTo(fresh);
          this.conflict.set(false);
        },
        error: () => undefined,
      });
  }

  private resetTo(service: SalonService | null): void {
    this.current.set(service);
    // The currency decides how the stored price reads, and a Копія keeps its own: switching it on an
    // existing service would re-denominate a number nobody re-typed. It is chosen once, on creation.
    this.form.controls.currency[service ? 'disable' : 'enable']();
    this.form.reset(service ? toSalonServiceFormValue(service) : EMPTY_SALON_SERVICE_FORM_VALUE);
  }
}
