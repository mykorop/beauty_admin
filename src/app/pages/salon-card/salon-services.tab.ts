import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import { finalize, forkJoin, type Observable } from 'rxjs';
import {
  type Dictionaries,
  DictionariesClient,
  type SalonService,
  SalonServicesClient,
} from '../../core/api/salon-services.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { serviceCategoryLabel } from '../../shared/service-category';
import { SalonCardStore } from './salon-card.store';
import { SalonServiceForm } from './salon-service.form';

/**
 * Каталог послуг of the Салон: every service, deactivated ones included, with how many Майстри
 * hold a Копія of it. Created, edited and deactivated here — never deleted, and never inside a
 * Видалений salon.
 */
@Component({
  selector: 'app-salon-services-tab',
  imports: [ButtonDirective, SalonServiceForm, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing(); as editing) {
      @if (dictionaries(); as dictionaries) {
        <app-salon-service-form
          [salonId]="salonId"
          [service]="editing.service"
          [dictionaries]="dictionaries"
          (closed)="close($event)"
        />
      }
    } @else if (rows(); as rows) {
      @if (writable()) {
        <div class="mb-3 flex max-w-6xl justify-end">
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-plus"
            data-testid="service-new"
            [label]="'services.new' | t"
            (click)="editing.set({ service: null })"
          ></button>
        </div>
      }
      <table class="w-full max-w-6xl rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b border-slate-200">
            <th class="px-4 py-3 font-normal">{{ 'services.field.name' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.category' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.column.duration' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.price' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.currency' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.isActive' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.column.masterCopies' | t }}</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.service.serviceId) {
            <tr class="border-b border-slate-100 last:border-0" data-testid="service-row">
              <td class="px-4 py-3 font-medium" data-testid="service-row-name">
                {{ row.service.name || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="service-row-category">{{ row.category }}</td>
              <td class="px-4 py-3" data-testid="service-row-duration">
                {{ 'services.value.minutes' | t: { count: row.service.durationMinutes } }}
              </td>
              <td class="px-4 py-3" data-testid="service-row-price">
                {{ row.price }}
                @if (row.service.priceUnit === 'PER_HOUR') {
                  <span class="text-slate-500">{{ 'services.value.perHour' | t }}</span>
                }
              </td>
              <td class="px-4 py-3" data-testid="service-row-currency">
                {{ row.service.currency }}
              </td>
              <td class="px-4 py-3">
                <p-tag
                  data-testid="service-row-active"
                  [severity]="row.service.isActive ? 'success' : 'secondary'"
                  [value]="(row.service.isActive ? 'services.active.yes' : 'services.active.no') | t"
                />
              </td>
              <td class="px-4 py-3" data-testid="service-row-copies">
                {{ row.service.masterCopyCount }}
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                @if (writable()) {
                  <button
                    pButton
                    type="button"
                    size="small"
                    icon="pi pi-pencil"
                    data-testid="service-edit"
                    [text]="true"
                    [label]="'salon.edit.open' | t"
                    [disabled]="busy()"
                    (click)="editing.set({ service: row.service })"
                  ></button>
                  @if (row.service.isActive) {
                    <button
                      pButton
                      type="button"
                      size="small"
                      severity="danger"
                      icon="pi pi-ban"
                      data-testid="service-deactivate"
                      [text]="true"
                      [label]="'services.deactivate' | t"
                      [disabled]="busy()"
                      (click)="deactivate(row.service)"
                    ></button>
                  } @else {
                    <button
                      pButton
                      type="button"
                      size="small"
                      icon="pi pi-check"
                      data-testid="service-activate"
                      [text]="true"
                      [label]="'services.activate' | t"
                      [disabled]="busy()"
                      (click)="activate(row.service)"
                    ></button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="py-8 text-center text-slate-600" data-testid="services-empty">
                {{ 'services.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
      <p class="mt-2 max-w-6xl text-xs text-slate-500" data-testid="services-copies-note">
        {{ 'services.copiesNote' | t }}
      </p>
    } @else if (failed()) {
      <p class="text-slate-600" data-testid="services-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonServicesTab {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(SalonCardStore);
  private readonly client = inject(SalonServicesClient);
  private readonly messages = inject(MessageService);

  protected readonly salonId = this.store.salon()?.salonId ?? '';
  private readonly services = signal<SalonService[] | null>(null);
  protected readonly dictionaries = signal<Dictionaries | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  /** The open form: on a service, or on a new one (`service: null`). */
  protected readonly editing = signal<{ service: SalonService | null } | null>(null);

  /** The backend refuses every write in a Видалений salon as well: `SALON_DELETED`. */
  protected readonly writable = computed(() => this.store.salon()?.status !== 'deleted');

  protected readonly rows = computed(() => {
    const format = new Intl.NumberFormat(this.i18n.locale());
    return (
      this.services()?.map((service) => ({
        service,
        category: serviceCategoryLabel(this.i18n, service.category),
        price: format.format(service.price),
      })) ?? null
    );
  });

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    if (this.salonId) {
      forkJoin({
        catalog: this.client.catalog(this.salonId),
        dictionaries: inject(DictionariesClient).get(),
      })
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: ({ catalog, dictionaries }) => {
            this.services.set(catalog.items);
            this.dictionaries.set(dictionaries);
          },
          // The interceptor has already worded the refusal as a toast.
          error: () => this.failed.set(true),
        });
    }
  }

  protected close(saved: SalonService | null): void {
    if (saved) {
      this.put(saved);
    }
    this.editing.set(null);
  }

  protected deactivate(service: SalonService): void {
    this.toggle(this.client.deactivate(this.salonId, service.serviceId), 'services.deactivated');
  }

  protected activate(service: SalonService): void {
    this.toggle(
      this.client.update(this.salonId, service.serviceId, {
        updatedAt: service.updatedAt,
        patch: { isActive: true },
      }),
      'services.activated',
    );
  }

  private toggle(request: Observable<SalonService>, doneKey: 'services.deactivated' | 'services.activated'): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (saved) => {
        this.put(saved);
        this.messages.add({ severity: 'success', summary: this.i18n.t(doneKey), life: 4000 });
      },
      // Already worded as a toast — all but a lost race, which the client leaves to a form; there
      // is none here, so the row says it itself.
      error: (error: unknown) => {
        if (error instanceof ApiError && error.code === EDIT_CONFLICT_CODE) {
          this.messages.add({
            severity: 'warn',
            summary: this.i18n.t('error.EDIT_CONFLICT'),
            life: 6000,
          });
        }
      },
    });
  }

  /** Replaces the saved service in place, or appends a new one. */
  private put(saved: SalonService): void {
    this.services.update((services) => {
      const known = services?.some((service) => service.serviceId === saved.serviceId);
      return known
        ? (services ?? []).map((service) => (service.serviceId === saved.serviceId ? saved : service))
        : [...(services ?? []), saved];
    });
  }
}
