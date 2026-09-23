import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { finalize, forkJoin, type Observable } from 'rxjs';
import { ApiError, EDIT_CONFLICT_CODE } from '../../core/api/api-error';
import { type Dictionaries, DictionariesClient } from '../../core/api/dictionaries.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { serviceCategoryLabel } from '../service-category';
import { ServiceCatalogForm } from './service-catalog.form';
import type { CatalogService, ServiceCatalogPort } from './service-catalog.model';

/**
 * A Каталог послуг: every service, deactivated ones included. Created, edited and deactivated here
 * — never deleted.
 *
 * Whose Каталог it is lives entirely in the `port` and in `copies`. A Салон's services are the
 * starting point for Копії майстрів, so the table counts them and repeats the rule that a new ціна
 * never reaches one; a Незалежний майстер has no Ростер under his Каталог, so neither the column
 * nor the note would say anything true, and both are absent.
 */
@Component({
  selector: 'app-service-catalog',
  imports: [ButtonDirective, ServiceCatalogForm, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing(); as editing) {
      @if (dictionaries(); as dictionaries) {
        <app-service-catalog-form
          [port]="port()"
          [service]="editing.service"
          [dictionaries]="dictionaries"
          [copies]="copies()"
          (closed)="close($event)"
        />
      }
    } @else if (rows(); as rows) {
      @if (writable()) {
        <div class="mb-3 flex flex-wrap justify-end">
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
      <div
        class="profile-table-scroll"
        tabindex="0"
        role="region"
        [attr.aria-label]="'salon.tab.services' | t"
      >
        <table class="profile-data-table">
          <thead class="text-xs text-muted">
            <tr class="border-b border-divider">
              <th class="px-4 py-3 font-normal">{{ 'services.field.name' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'services.field.category' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'services.column.duration' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'services.field.price' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'services.field.currency' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'services.field.isActive' | t }}</th>
              @if (copies()) {
                <th class="px-4 py-3 font-normal">{{ 'services.column.masterCopies' | t }}</th>
              }
              <th class="table-actions px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.service.serviceId) {
              <tr class="border-b border-divider last:border-0" data-testid="service-row">
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
                    <span class="text-muted">{{ 'services.value.perHour' | t }}</span>
                  }
                </td>
                <td class="px-4 py-3" data-testid="service-row-currency">
                  {{ row.service.currency }}
                </td>
                <td class="px-4 py-3">
                  <p-tag
                    data-testid="service-row-active"
                    [severity]="row.service.isActive ? 'success' : 'secondary'"
                    [value]="
                      (row.service.isActive ? 'services.active.yes' : 'services.active.no') | t
                    "
                  />
                </td>
                @if (copies()) {
                  <td class="px-4 py-3" data-testid="service-row-copies">
                    {{ row.service.masterCopyCount }}
                  </td>
                }
                <td class="table-actions px-4 py-3 text-right">
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
                <td
                  [attr.colspan]="columns()"
                  class="py-8 text-center text-muted"
                  data-testid="services-empty"
                >
                  {{ 'services.empty' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="mt-2 max-w-6xl text-xs text-muted" [attr.data-testid]="noteTestId()">
        {{ (copies() ? 'services.copiesNote' : 'services.ownCatalogNote') | t }}
      </p>
    } @else if (failed()) {
      <p class="text-muted" data-testid="services-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class ServiceCatalogTab implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);
  private readonly dictionariesClient = inject(DictionariesClient);
  private readonly destroyRef = inject(DestroyRef);

  /** Whose Каталог this is — every call the table and the form make goes through it. */
  readonly port = input.required<ServiceCatalogPort>();
  /** A Видалений profile is read-only: the backend refuses every write here as well. */
  readonly writable = input(true);
  /** Копії майстрів can exist in this Каталог: the column and the cascade note belong to it. */
  readonly copies = input(false);

  private readonly services = signal<CatalogService[] | null>(null);
  protected readonly dictionaries = signal<Dictionaries | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  /** The open form: on a service, or on a new one (`service: null`). */
  protected readonly editing = signal<{ service: CatalogService | null } | null>(null);

  protected readonly columns = computed(() => (this.copies() ? 8 : 7));
  protected readonly noteTestId = computed(() =>
    this.copies() ? 'services-copies-note' : 'services-own-catalog-note',
  );

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

  // `port` is an input, so the first read waits for the bindings — not the constructor.
  ngOnInit(): void {
    forkJoin({ catalog: this.port().list(), dictionaries: this.dictionariesClient.get() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalog, dictionaries }) => {
          this.services.set(catalog.items);
          this.dictionaries.set(dictionaries);
        },
        // The interceptor has already worded the refusal as a toast.
        error: () => this.failed.set(true),
      });
  }

  protected close(saved: CatalogService | null): void {
    if (saved) {
      this.put(saved);
    }
    this.editing.set(null);
  }

  protected deactivate(service: CatalogService): void {
    this.toggle(this.port().deactivate(service.serviceId), 'services.deactivated');
  }

  protected activate(service: CatalogService): void {
    this.toggle(
      this.port().update(service.serviceId, {
        updatedAt: service.updatedAt,
        patch: { isActive: true },
      }),
      'services.activated',
    );
  }

  private toggle(
    request: Observable<CatalogService>,
    doneKey: 'services.deactivated' | 'services.activated',
  ): void {
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
  private put(saved: CatalogService): void {
    this.services.update((services) => {
      const known = services?.some((service) => service.serviceId === saved.serviceId);
      return known
        ? (services ?? []).map((service) =>
            service.serviceId === saved.serviceId ? saved : service,
          )
        : [...(services ?? []), saved];
    });
  }
}
