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
import { map } from 'rxjs';
import {
  type MasterService,
  SalonMasterServicesClient,
} from '../../core/api/salon-master-services.client';
import type { SalonService } from '../../core/api/salon-services.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { concurrentEdit } from '../../shared/concurrent-edit';
import { SAVED_TOAST } from '../../shared/done-toast';
import {
  buildMasterServicePatch,
  EMPTY_MASTER_SERVICE_FORM_VALUE,
  fromCatalogService,
  toMasterServiceFormValue,
  toNewMasterService,
} from './master-service-patch';

const numberValidators = (min: number, max: number): ValidatorFn[] => [
  Validators.required,
  Validators.min(min),
  Validators.max(max),
  Validators.pattern(/^\d+$/),
];

/**
 * One Копія майстра: a new one, taken from the Каталог послуг and starting from its ціна and
 * тривалість, or an existing one, of which only the changed fields are sent, under the `updatedAt`
 * the form was opened with. Only ціна, тривалість and активність are the Копія's own — the rest is
 * the Каталог's and is edited there.
 */
@Component({
  selector: 'app-master-service-form',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputText,
    Message,
    Select,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="profile-fields profile-form"
      data-testid="copy-form"
      [formGroup]="form"
      (ngSubmit)="edit.save()"
    >
      <h2 class="field-wide text-base font-medium" data-testid="copy-form-title">
        {{ (current() ? 'copies.form.editTitle' : 'copies.form.newTitle') | t }}
      </h2>

      <label class="pt-2 text-muted" for="copy-service">{{ 'copies.field.service' | t }}</label>
      @if (current(); as copy) {
        <p class="pt-2 font-medium" data-testid="copy-service-name">{{ copy.name || '—' }}</p>
      } @else {
        <p-select
          inputId="copy-service"
          data-testid="copy-service"
          formControlName="serviceId"
          optionLabel="label"
          optionValue="value"
          [filter]="true"
          [options]="serviceOptions()"
          [placeholder]="'copies.field.servicePlaceholder' | t"
          (onChange)="startFromCatalog($event.value)"
        />
      }

      <label class="pt-2 text-muted" for="copy-duration">{{
        'services.field.durationMinutes' | t
      }}</label>
      <div>
        <input
          pInputText
          class="w-full"
          id="copy-duration"
          data-testid="copy-duration"
          type="number"
          min="1"
          max="720"
          step="1"
          formControlName="durationMinutes"
          [invalid]="invalid('durationMinutes')"
          [attr.aria-invalid]="invalid('durationMinutes')"
        />
        @if (catalogValues(); as catalog) {
          <p class="mt-1 text-xs text-muted" data-testid="copy-catalog-duration">
            {{ 'copies.form.inCatalog' | t }}:
            {{ 'services.value.minutes' | t: { count: catalog.durationMinutes } }}
          </p>
        }
      </div>

      <label class="pt-2 text-muted" for="copy-price">{{ 'services.field.price' | t }}</label>
      <div>
        <div class="flex items-center gap-2">
          <input
            pInputText
            class="flex-1"
            id="copy-price"
            data-testid="copy-price"
            type="number"
            min="0"
            step="1"
            formControlName="price"
            [invalid]="invalid('price')"
            [attr.aria-invalid]="invalid('price')"
          />
          <span class="text-muted" data-testid="copy-currency">{{ currency() }}</span>
        </div>
        @if (catalogValues(); as catalog) {
          <p class="mt-1 text-xs text-muted" data-testid="copy-catalog-price">
            {{ 'copies.form.inCatalog' | t }}: {{ catalog.price }} {{ currency() }}
          </p>
        }
        @if (perHour()) {
          <p class="mt-1 text-xs text-muted">{{ 'services.form.perHourHint' | t }}</p>
        }
      </div>

      @if (current()) {
        <label class="pt-2 text-muted" for="copy-active">{{ 'services.field.isActive' | t }}</label>
        <p-checkbox
          inputId="copy-active"
          data-testid="copy-active"
          formControlName="isActive"
          [binary]="true"
        />
      }

      <label class="pt-2 text-muted" for="copy-reason">{{ 'salon.edit.reason' | t }}</label>
      <input
        pInputText
        id="copy-reason"
        data-testid="copy-reason"
        maxlength="500"
        [formControl]="edit.reason"
      />

      <p class="field-wide text-xs text-muted" data-testid="copy-client-note">
        {{ 'copies.form.clientNote' | t }}
      </p>

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
          data-testid="copy-save"
          [label]="'salon.edit.save' | t"
          [disabled]="!edit.canSave()"
          [loading]="edit.busy() && !edit.conflict()"
        ></button>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="copy-cancel"
          [text]="true"
          [label]="'salon.edit.cancel' | t"
          [disabled]="edit.busy()"
          (click)="closed.emit(null)"
        ></button>
      </div>
    </form>
  `,
})
export class MasterServiceForm implements OnInit {
  private readonly client = inject(SalonMasterServicesClient);
  private readonly i18n = inject(I18nService);

  readonly salonId = input.required<string>();
  readonly masterId = input.required<string>();
  /** The Копія to edit; `null` opens the form on a new one. */
  readonly copy = input.required<MasterService | null>();
  /** Каталог services the master holds no Копія of — what a new one can be taken from. */
  readonly available = input.required<readonly SalonService[]>();

  /** The saved Копія, or `null` when cancelled — either way the tab goes back to the table. */
  readonly closed = output<MasterService | null>();
  /** The Копія was removed meanwhile — found by a save or a conflict reload: the id of what is gone. */
  readonly gone = output<string>();

  /** What the form is open on: the input, until a conflict reload brings a fresher one. */
  protected readonly current = signal<MasterService | null>(null);

  protected readonly form = new FormGroup({
    serviceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    durationMinutes: new FormControl<number | null>(null, numberValidators(1, 720)),
    price: new FormControl<number | null>(null, numberValidators(0, Number.MAX_SAFE_INTEGER)),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  protected readonly serviceOptions = computed(() =>
    this.available().map((service) => ({
      value: service.serviceId,
      label: service.isActive
        ? service.name
        : `${service.name} · ${this.i18n.t('services.active.no')}`,
    })),
  );

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The Каталог service a new Копія is being taken from. */
  private readonly chosen = computed(() => {
    const serviceId = this.value().serviceId;
    return this.available().find((service) => service.serviceId === serviceId) ?? null;
  });
  protected readonly catalogValues = computed(
    () => (this.current() ? this.current()?.catalog : this.chosen()) ?? null,
  );
  protected readonly currency = computed(() => (this.current() ?? this.chosen())?.currency ?? '');
  protected readonly perHour = computed(
    () => (this.current() ?? this.chosen())?.priceUnit === 'PER_HOUR',
  );

  /**
   * Updated in place, or added from the Каталог. A Копія removed meanwhile — refused as `NOT_FOUND`,
   * or no longer there on a reload — leaves nothing to edit: the form closes, and the tab drops it.
   */
  protected readonly edit = concurrentEdit({
    form: this.form,
    current: this.current,
    changes: buildMasterServicePatch,
    save: (patch, reason) => {
      const copy = this.current();
      if (copy) {
        return this.client.update(this.salonId(), this.masterId(), copy.serviceId, {
          updatedAt: copy.updatedAt,
          patch: patch ?? {},
          reason,
        });
      }
      const fresh = toNewMasterService(this.form.getRawValue());
      return fresh && this.client.add(this.salonId(), this.masterId(), { ...fresh, reason });
    },
    reload: (copy) =>
      this.client
        .list(this.salonId(), this.masterId())
        .pipe(map(({ items }) => items.find((item) => item.serviceId === copy.serviceId) ?? null)),
    fill: (copy) => this.resetTo(copy),
    saved: (copy) => this.closed.emit(copy),
    // The POST never overwrites: a Копія added meanwhile comes back as stored, not as typed.
    toast: (saved, typed) => {
      const fresh = this.current() ? null : toNewMasterService(typed);
      return fresh &&
        (saved.price !== fresh.price || saved.durationMinutes !== fresh.durationMinutes)
        ? { key: 'copies.form.alreadyHeld', warn: true }
        : SAVED_TOAST;
    },
    gone: (copy) => this.gone.emit(copy.serviceId),
  });

  ngOnInit(): void {
    this.resetTo(this.copy());
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.dirty;
  }

  /** Choosing a service fills in what the Каталог holds; the administrator types over it. */
  protected startFromCatalog(serviceId: string): void {
    const service = this.available().find((candidate) => candidate.serviceId === serviceId);
    if (service) {
      this.form.patchValue(fromCatalogService(service));
    }
  }

  private resetTo(copy: MasterService | null): void {
    this.current.set(copy);
    this.form.reset(copy ? toMasterServiceFormValue(copy) : EMPTY_MASTER_SERVICE_FORM_VALUE);
  }
}
