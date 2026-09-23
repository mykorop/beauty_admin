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
import { catchError, EMPTY, filter, map, switchMap, tap } from 'rxjs';
import {
  type Appointment,
  APPOINTMENT_STATUS_SEVERITY,
  APPOINTMENT_STATUSES,
} from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { formatVenueDateTime, venueToday } from '../venue-date';
import { appointmentStatusLabel, formatPrice } from './appointment-wording';
import { AppointmentDetailsPanel } from './appointment-details';
import { AppointmentInteraction } from './appointment-interaction';
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
 * A Запис is never **made** here — there is no «new» button and no endpoint behind one: a Запис is
 * made by a Клієнт or by the business, never by the platform. Acting on one that exists is the
 * open card's own business (`app-appointment-details`); which Запис is open, its read and where an
 * action's answer lands belong to `AppointmentInteraction`, and every new window is a new list.
 *
 * Whose Записи these are lives entirely in the `port`; the filters live in the address, so a view
 * can be linked to.
 */
@Component({
  selector: 'app-appointments',
  imports: [AppointmentDetailsPanel, FormsModule, InputText, Select, Tag, TranslatePipe],
  providers: [AppointmentInteraction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filters(); as filters) {
      <div class="appointment-filters mb-4 flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-xs text-muted">
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
        <label class="flex flex-col gap-1 text-xs text-muted">
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
        <div class="profile-table-scroll" tabindex="0" role="region" [attr.aria-label]="'nav.appointments' | t"><table class="profile-data-table appointments-table">
          <thead class="text-xs text-muted">
            <tr class="border-b border-divider">
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
              @let open = interaction.isOpen(row.appointment.appointmentId);
              <tr
                class="cursor-pointer border-b border-divider last:border-0 hover:bg-raised"
                data-testid="appointment-row"
                [class.appointment-stale]="row.stale"
                (click)="interaction.toggle(row.appointment.appointmentId)"
              >
                <td class="px-3 py-3">
                  <button
                    type="button"
                    class="appointment-toggle pi text-muted"
                    data-testid="appointment-row-toggle"
                    [class.pi-chevron-right]="!open"
                    [class.pi-chevron-down]="open"
                    [attr.aria-expanded]="open"
                    [attr.aria-label]="'appointments.details.open' | t"
                  ></button>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span data-testid="appointment-row-when">{{ row.when }}</span>
                  @if (row.stale) {
                    <p class="text-xs text-warning whitespace-normal" data-testid="appointment-row-stale">
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
              @if (open) {
                <tr class="border-b border-divider bg-raised" data-testid="appointment-details">
                  <td></td>
                  <td class="px-4 py-4" [attr.colspan]="columns()">
                    @if (interaction.opened()?.details; as details) {
                      <app-appointment-details [details]="details" />
                    } @else if (interaction.opened()?.failed) {
                      <p class="text-muted" data-testid="appointment-details-failed">{{ 'card.failed' | t }}</p>
                    } @else {
                      <p class="text-muted" data-testid="appointment-details-loading">{{ 'appointments.details.loading' | t }}</p>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td [attr.colspan]="columns() + 1" class="py-8 text-center text-muted" data-testid="appointments-empty">
                  {{ 'appointments.empty' | t }}
                </td>
              </tr>
            }
          </tbody>
        </table></div>
        <p class="mt-2 max-w-6xl text-xs text-muted" data-testid="appointments-readonly">
          {{ 'appointments.readonly' | t }}
        </p>
      } @else if (failed()) {
        <p class="text-muted" data-testid="appointments-failed">{{ 'card.failed' | t }}</p>
      }
    }
  `,
})
export class AppointmentsTab implements OnInit {
  /** Whose Записи these are — the list and its Ростер are read through it. */
  readonly port = input.required<AppointmentsPort>();

  protected readonly interaction: AppointmentInteraction<Appointment> = inject(AppointmentInteraction);

  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly filters = signal<AppointmentFilters | null>(null);
  protected readonly masters = signal<AppointmentsFilterMaster[] | null>(null);
  /** The clock the answered page was cut on — the venue's, as the backend states it. */
  private readonly timezone = signal('');
  protected readonly failed = signal(false);

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
      this.interaction.rows()?.map((appointment) => ({
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
          this.failed.set(false);
          this.interaction.show(null);
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
        this.interaction.show(page.items);
      });
  }

  protected setFilter(change: Partial<AppointmentFilters>): void {
    // A cleared date input reports '' and a cleared select `null`; `toQueryParams` turns both into
    // a parameter the router drops, which is how a filter is unset.
    const asked = { ...this.filters(), ...change } as AppointmentFilters;
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(asked) });
  }
}
