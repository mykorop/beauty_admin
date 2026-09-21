import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { type MasterService, SalonMasterServicesClient } from '../../core/api/salon-master-services.client';
import { type SalonService, SalonServicesClient } from '../../core/api/salon-services.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { serviceCategoryLabel } from '../../shared/service-category';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { MasterServiceForm } from './master-service.form';
import { isOffered, servicesWithoutCopy } from './master-service-patch';
import { SalonMasterStore } from './salon-master.store';

/**
 * Копії послуг of a Майстер салону: what he performs and for how much — his own ціна and тривалість
 * next to the Каталог's. Edited, added from the Каталог and removed here, never inside a Видалений
 * salon. Every Копія he is assigned is listed, whether a Клієнт can book it or not.
 */
@Component({
  selector: 'app-salon-master-services-tab',
  imports: [ButtonDirective, MasterServiceForm, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing(); as editing) {
      <app-master-service-form
        [salonId]="salonId"
        [masterId]="masterId"
        [copy]="editing.copy"
        [available]="available()"
        (closed)="close($event)"
        (gone)="vanished($event)"
      />
    } @else if (rows(); as rows) {
      @if (writable()) {
        <div class="mb-3 flex max-w-6xl items-center justify-end gap-3">
          @if (available().length === 0) {
            <span class="text-xs text-slate-500" data-testid="copy-new-none">{{ 'copies.new.none' | t }}</span>
          }
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-plus"
            data-testid="copy-new"
            [label]="'copies.new' | t"
            [disabled]="available().length === 0"
            (click)="editing.set({ copy: null })"
          ></button>
        </div>
      }
      <table class="w-full max-w-6xl rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b border-slate-200">
            <th class="px-4 py-3 font-normal">{{ 'services.field.name' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.category' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.column.duration' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'copies.column.catalogDuration' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.price' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'copies.column.catalogPrice' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'services.field.isActive' | t }}</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.copy.serviceId) {
            <tr class="border-b border-slate-100 last:border-0" data-testid="copy-row">
              <td class="px-4 py-3 font-medium" data-testid="copy-row-name">
                {{ row.copy.name || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="copy-row-category">{{ row.category }}</td>
              <td class="px-4 py-3" data-testid="copy-row-duration" [class.font-medium]="row.durationDiffers">
                {{ 'services.value.minutes' | t: { count: row.copy.durationMinutes } }}
              </td>
              <td class="px-4 py-3 text-slate-500" data-testid="copy-row-catalog-duration">
                @if (row.copy.catalog; as catalog) {
                  {{ 'services.value.minutes' | t: { count: catalog.durationMinutes } }}
                } @else {
                  —
                }
              </td>
              <td class="px-4 py-3" data-testid="copy-row-price" [class.font-medium]="row.priceDiffers">
                {{ row.price }} {{ row.copy.currency }}
                @if (row.copy.priceUnit === 'PER_HOUR') {
                  <span class="text-slate-500">{{ 'services.value.perHour' | t }}</span>
                }
              </td>
              <td class="px-4 py-3 text-slate-500" data-testid="copy-row-catalog-price">
                {{ row.catalogPrice ?? '—' }}
              </td>
              <td class="px-4 py-3">
                <p-tag
                  data-testid="copy-row-active"
                  [severity]="row.copy.isActive ? 'success' : 'secondary'"
                  [value]="(row.copy.isActive ? 'services.active.yes' : 'services.active.no') | t"
                />
                @if (row.notOfferedKey; as key) {
                  <p class="mt-1 text-xs text-amber-700" data-testid="copy-row-not-offered">
                    {{ key | t }}
                  </p>
                }
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                @if (writable()) {
                  @if (removing() === row.copy.serviceId) {
                    <span class="mr-2 text-xs text-slate-600">{{ 'copies.remove.confirmText' | t }}</span>
                    <button
                      pButton
                      type="button"
                      size="small"
                      severity="danger"
                      data-testid="copy-remove-confirm"
                      [label]="'copies.remove' | t"
                      [loading]="busy()"
                      (click)="remove(row.copy)"
                    ></button>
                    <button
                      pButton
                      type="button"
                      size="small"
                      severity="secondary"
                      data-testid="copy-remove-cancel"
                      [text]="true"
                      [label]="'salon.edit.cancel' | t"
                      [disabled]="busy()"
                      (click)="removing.set(null)"
                    ></button>
                  } @else {
                    <button
                      pButton
                      type="button"
                      size="small"
                      icon="pi pi-pencil"
                      data-testid="copy-edit"
                      [text]="true"
                      [label]="'salon.edit.open' | t"
                      [disabled]="busy()"
                      (click)="editing.set({ copy: row.copy })"
                    ></button>
                    <button
                      pButton
                      type="button"
                      size="small"
                      severity="danger"
                      icon="pi pi-times"
                      data-testid="copy-remove"
                      [text]="true"
                      [label]="'copies.remove' | t"
                      [disabled]="busy()"
                      (click)="removing.set(row.copy.serviceId)"
                    ></button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="py-8 text-center text-slate-600" data-testid="copies-empty">
                {{ 'copies.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
      <p class="mt-2 max-w-6xl text-xs text-slate-500" data-testid="copies-note">
        {{ 'copies.note' | t }}
      </p>
    } @else if (failed()) {
      <p class="text-slate-600" data-testid="copies-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonMasterServicesTab {
  private readonly i18n = inject(I18nService);
  private readonly salonStore = inject(SalonCardStore);
  private readonly client = inject(SalonMasterServicesClient);
  private readonly messages = inject(MessageService);

  // The card renders its tabs only once the salon and the master are loaded, and rebuilds them for
  // another pair.
  protected readonly salonId = this.salonStore.salon()?.salonId ?? '';
  protected readonly masterId = inject(SalonMasterStore).master()?.masterId ?? '';
  private readonly copies = signal<MasterService[] | null>(null);
  private readonly catalog = signal<SalonService[]>([]);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  /** The open form: on a Копія, or on a new one (`copy: null`). */
  protected readonly editing = signal<{ copy: MasterService | null } | null>(null);
  /** The Копія whose removal waits for a second click. */
  protected readonly removing = signal<string | null>(null);

  /** The backend refuses every write in a Видалений salon as well: `SALON_DELETED`. */
  protected readonly writable = computed(() => this.salonStore.salon()?.status !== 'deleted');

  protected readonly available = computed(() =>
    servicesWithoutCopy(this.catalog(), this.copies() ?? [], this.i18n.locale()),
  );

  protected readonly rows = computed(() => {
    const format = new Intl.NumberFormat(this.i18n.locale());
    return (
      this.copies()?.map((copy) => ({
        copy,
        category: serviceCategoryLabel(this.i18n, copy.category),
        price: format.format(copy.price),
        catalogPrice: copy.catalog ? `${format.format(copy.catalog.price)} ${copy.currency}` : null,
        priceDiffers: !!copy.catalog && copy.catalog.price !== copy.price,
        durationDiffers: !!copy.catalog && copy.catalog.durationMinutes !== copy.durationMinutes,
        // A Копія that is on, yet no Клієнт can book it — the reason is in the Каталог.
        notOfferedKey:
          !copy.isActive || isOffered(copy)
            ? null
            : copy.catalog
              ? ('copies.notOffered.catalogInactive' as const)
              : ('copies.notOffered.catalogMissing' as const),
      })) ?? null
    );
  });

  constructor() {
    if (this.salonId && this.masterId) {
      forkJoin({
        copies: this.client.list(this.salonId, this.masterId),
        catalog: inject(SalonServicesClient).catalog(this.salonId),
      })
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: ({ copies, catalog }) => {
            this.copies.set(copies.items);
            this.catalog.set(catalog.items);
          },
          // The interceptor has already worded the refusal as a toast.
          error: () => this.failed.set(true),
        });
    }
  }

  protected close(saved: MasterService | null): void {
    if (saved) {
      this.put(saved);
    }
    this.editing.set(null);
  }

  protected remove(copy: MasterService): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.client
      .remove(this.salonId, this.masterId, copy.serviceId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.drop(copy.serviceId);
          this.removing.set(null);
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t('copies.removed'),
            life: 4000,
          });
        },
        // Already worded as a toast; the row stays, waiting for another try or a cancel — unless
        // somebody removed the Копія first, and then it is gone here too.
        error: (error: unknown) => {
          if (error instanceof ApiError && error.code === 'NOT_FOUND') {
            this.drop(copy.serviceId);
            this.removing.set(null);
          }
        },
      });
  }

  /** The form found its Копія removed meanwhile: there is nothing left to edit. */
  protected vanished(serviceId: string): void {
    this.drop(serviceId);
    this.editing.set(null);
  }

  private drop(serviceId: string): void {
    this.copies.update((copies) => copies?.filter((copy) => copy.serviceId !== serviceId) ?? null);
  }

  /** Replaces the saved Копія in place, or appends a new one. */
  private put(saved: MasterService): void {
    this.copies.update((copies) => {
      const known = copies?.some((copy) => copy.serviceId === saved.serviceId);
      return known
        ? (copies ?? []).map((copy) => (copy.serviceId === saved.serviceId ? saved : copy))
        : [...(copies ?? []), saved];
    });
  }
}
