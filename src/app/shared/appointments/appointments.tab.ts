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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { catchError, EMPTY, filter, map, Subject, switchMap, tap } from 'rxjs';
import {
  type Appointment,
  APPOINTMENT_STATUS_SEVERITY,
  APPOINTMENT_STATUSES,
  type AppointmentDetails,
} from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { formatVenueDateTime, venueToday } from '../venue-date';
import { appointmentStatusLabel, formatPrice } from './appointment-wording';
import { AppointmentDetailsPanel } from './appointment-details';
import {
  type AppointmentFilters,
  isStaleBooking,
  matchesAddress,
  parseAppointmentFilters,
  toApiQuery,
  toQueryParams,
} from './appointment-filters';
import type { AppointmentsFilterMaster, AppointmentsPort } from './appointments.model';

/**
 * Записи of a Салон or of a Майстер: the window the reader asked for, soonest first, each row
 * opening into the whole Запис.
 *
 * Read-only by design — there is no «new» button here and no endpoint behind one: a Запис is made
 * by a Клієнт or by the business, never by the platform. Whose Записи these are lives entirely in
 * the `port`; the filters live in the address, so a view can be linked to.
 */
@Component({
  selector: 'app-appointments',
  imports: [AppointmentDetailsPanel, FormsModule, InputText, Select, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filters(); as filters) {
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          {{ 'appointments.filter.from' | t }}
          <input
            pInputText
            type="date"
            data-testid="appointments-filter-from"
            [max]="filters.to"
            [value]="filters.from"
            (change)="setFilter({ from: $any($event.target).value })"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-600">
          {{ 'appointments.filter.to' | t }}
          <input
            pInputText
            type="date"
            data-testid="appointments-filter-to"
            [min]="filters.from"
            [value]="filters.to"
            (change)="setFilter({ to: $any($event.target).value })"
          />
        </label>
        <p-select
          data-testid="appointments-filter-status"
          class="w-52"
          optionLabel="label"
          optionValue="value"
          [options]="statusOptions()"
          [showClear]="true"
          [placeholder]="'appointments.filter.status' | t"
          [ariaLabel]="'appointments.filter.status' | t"
          [ngModel]="filters.status"
          (ngModelChange)="setFilter({ status: $event })"
        />
        @if (masters(); as masters) {
          <p-select
            data-testid="appointments-filter-master"
            class="w-64"
            optionLabel="masterName"
            optionValue="masterId"
            [options]="masters"
            [showClear]="true"
            [placeholder]="'appointments.filter.master' | t"
            [ariaLabel]="'appointments.filter.master' | t"
            [ngModel]="filters.masterId"
            (ngModelChange)="setFilter({ masterId: $event })"
          />
        }
      </div>

      @if (rows(); as rows) {
        <table class="w-full max-w-6xl rounded-lg border border-slate-200 bg-white text-left text-sm">
          <thead class="text-xs text-slate-500">
            <tr class="border-b border-slate-200">
              <th class="w-10 px-3 py-3"></th>
              <th class="px-4 py-3 font-normal">{{ 'appointments.column.when' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'appointments.column.client' | t }}</th>
              @if (showMaster()) {
                <th class="px-4 py-3 font-normal">{{ 'appointments.column.master' | t }}</th>
              }
              <th class="px-4 py-3 font-normal">{{ 'appointments.column.services' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'appointments.column.price' | t }}</th>
              <th class="px-4 py-3 font-normal">{{ 'appointments.column.status' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.appointment.appointmentId) {
              <tr
                class="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                data-testid="appointment-row"
                [class.bg-amber-50]="row.stale"
                (click)="toggle(row.appointment)"
              >
                <td class="px-3 py-3">
                  <button
                    type="button"
                    class="pi text-slate-500"
                    data-testid="appointment-row-toggle"
                    [class.pi-chevron-right]="!isOpen(row.appointment)"
                    [class.pi-chevron-down]="isOpen(row.appointment)"
                    [attr.aria-expanded]="isOpen(row.appointment)"
                    [attr.aria-label]="'appointments.details.open' | t"
                  ></button>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span data-testid="appointment-row-when">{{ row.when }}</span>
                  @if (row.stale) {
                    <p class="text-xs text-amber-700" data-testid="appointment-row-stale">
                      {{ 'appointments.stale' | t }}
                    </p>
                  }
                </td>
                <td class="px-4 py-3" data-testid="appointment-row-client">{{ row.appointment.clientName || '—' }}</td>
                @if (showMaster()) {
                  <td class="px-4 py-3" data-testid="appointment-row-master">
                    {{ row.appointment.masterName || '—' }}
                  </td>
                }
                <td class="px-4 py-3" data-testid="appointment-row-services">
                  {{ row.services }}
                  @if (row.appointment.isManual) {
                    <p-tag class="ml-2" severity="warn" data-testid="appointment-row-manual" [value]="'appointments.manual' | t" />
                  }
                </td>
                <td class="px-4 py-3 whitespace-nowrap" data-testid="appointment-row-price">
                  {{ row.price }} {{ row.appointment.currency }}
                </td>
                <td class="px-4 py-3">
                  <p-tag data-testid="appointment-row-status" [severity]="row.statusSeverity" [value]="row.status" />
                </td>
              </tr>
              @if (isOpen(row.appointment)) {
                <tr class="border-b border-slate-100 bg-slate-50/50" data-testid="appointment-details">
                  <td></td>
                  <td class="px-4 py-4" [attr.colspan]="columns()">
                    @if (details(); as details) {
                      <app-appointment-details [details]="details" />
                    } @else if (detailsFailed()) {
                      <p class="text-slate-600" data-testid="appointment-details-failed">{{ 'card.failed' | t }}</p>
                    } @else {
                      <p class="text-slate-500" data-testid="appointment-details-loading">{{ 'appointments.details.loading' | t }}</p>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td [attr.colspan]="columns() + 1" class="py-8 text-center text-slate-600" data-testid="appointments-empty">
                  {{ 'appointments.empty' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table>
        <p class="mt-2 max-w-6xl text-xs text-slate-500" data-testid="appointments-readonly">
          {{ 'appointments.readonly' | t }}
        </p>
      } @else if (failed()) {
        <p class="text-slate-600" data-testid="appointments-failed">{{ 'card.failed' | t }}</p>
      }
    }
  `,
})
export class AppointmentsTab implements OnInit {
  /** Whose Записи these are — both reads of the tab go through it. */
  readonly port = input.required<AppointmentsPort>();

  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly filters = signal<AppointmentFilters | null>(null);
  protected readonly masters = signal<AppointmentsFilterMaster[] | null>(null);
  private readonly appointments = signal<Appointment[] | null>(null);
  /** The clock the answered page was cut on — the venue's, as the backend states it. */
  private readonly timezone = signal('');
  protected readonly failed = signal(false);

  /** The Запис whose card is open, or `null`; every change goes through `opened`. */
  private readonly openId = signal<string | null>(null);
  private readonly opened = new Subject<string | null>();
  protected readonly details = signal<AppointmentDetails | null>(null);
  protected readonly detailsFailed = signal(false);

  protected readonly statusOptions = computed(() =>
    APPOINTMENT_STATUSES.map((value) => ({ value, label: this.i18n.t(`appointments.status.${value}`) })),
  );

  /**
   * The Майстер column stands on a Салон's tab and nowhere else. It follows the `port`, not the
   * Ростер it is filtered by: a column that appeared only once that read answered would shift the
   * table under the reader.
   */
  protected readonly showMaster = computed(() => this.port().masters !== null);

  /** The columns beside the chevron. */
  protected readonly columns = computed(() => (this.showMaster() ? 6 : 5));

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const timezone = this.timezone();
    const money = new Intl.NumberFormat(locale);
    const now = new Date();
    return (
      this.appointments()?.map((appointment) => ({
        appointment,
        when: formatVenueDateTime(appointment.startTime, locale, timezone),
        services: appointment.serviceNames.join(', ') || '—',
        price: formatPrice(money, appointment.totalPrice),
        status: appointmentStatusLabel(this.i18n, appointment.status),
        statusSeverity: APPOINTMENT_STATUS_SEVERITY[appointment.status] ?? 'secondary',
        // A Запис still «заброньовано» whose time has passed: nobody closed it.
        stale: isStaleBooking(appointment, now),
      })) ?? null
    );
  });

  // `port` is an input, so the first read waits for the bindings — not the constructor.
  ngOnInit(): void {
    const today = venueToday(this.port().timezone);

    this.port()
      .masters?.pipe(takeUntilDestroyed(this.destroyRef))
      // The filter is a convenience; a Ростер that failed to load leaves the list itself standing.
      .subscribe({ next: (masters) => this.masters.set(masters), error: () => this.masters.set([]) });

    // One card at a time: opening another drops the request for the last one, so a slow answer
    // cannot land under the row that replaced it.
    this.opened
      .pipe(
        tap(() => {
          this.details.set(null);
          this.detailsFailed.set(false);
        }),
        switchMap((appointmentId) =>
          appointmentId === null
            ? EMPTY
            : this.port()
                .details(appointmentId)
                // Including a Запис that has since vanished: the row says so instead of a toast.
                .pipe(catchError(() => (this.detailsFailed.set(true), EMPTY))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => this.details.set(details));

    this.route.queryParamMap
      .pipe(
        map((params) => ({ params, asked: parseAppointmentFilters(params, today) })),
        // An address that named no window, or one the backend would refuse, is rewritten to the
        // window actually shown — so a copied link reopens this view, not a refusal.
        filter(({ params, asked }) => {
          if (matchesAddress(params, asked)) {
            return true;
          }
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: toQueryParams(asked),
            replaceUrl: true,
          });
          return false;
        }),
        tap(({ asked }) => {
          this.filters.set(asked);
          this.appointments.set(null);
          this.failed.set(false);
          this.close();
        }),
        // A new window starts the list over; the answer to the old one is dropped.
        switchMap(({ asked }) =>
          this.port()
            .list(toApiQuery(asked))
            // The interceptor has already worded the refusal as a toast.
            .pipe(catchError(() => (this.failed.set(true), EMPTY))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.timezone.set(page.timezone || this.port().timezone);
        this.appointments.set(page.items);
      });
  }

  protected isOpen(appointment: Appointment): boolean {
    return this.openId() === appointment.appointmentId;
  }

  protected toggle(appointment: Appointment): void {
    const next = this.isOpen(appointment) ? null : appointment.appointmentId;
    this.openId.set(next);
    this.opened.next(next);
  }

  protected setFilter(change: Partial<AppointmentFilters>): void {
    // A cleared date input reports '' and a cleared select `null`; `toQueryParams` turns both into
    // a parameter the router drops, which is how a filter is unset.
    const asked = { ...this.filters(), ...change } as AppointmentFilters;
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(asked) });
  }

  private close(): void {
    this.openId.set(null);
    this.opened.next(null);
  }
}
