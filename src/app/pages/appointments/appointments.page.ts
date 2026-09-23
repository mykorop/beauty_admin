import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  of,
  type OperatorFunction,
  switchMap,
  tap,
} from 'rxjs';
import {
  APPOINTMENT_STATUSES,
  AppointmentsClient,
  type VenueAppointment,
} from '../../core/api/appointments.client';
import { ClientsClient } from '../../core/api/clients.client';
import { MastersClient } from '../../core/api/masters.client';
import { SalonMastersClient } from '../../core/api/salon-masters.client';
import { SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { venueToday } from '../../shared/venue-date';
import { AppointmentsDaySection } from './appointments-day.section';
import {
  isScoped,
  matchesAddress,
  parsePlatformAppointmentFilters,
  type PlatformAppointmentFilters,
  toApiQuery,
  toQueryParams,
} from './platform-appointment-filters';
import { PlatformAppointmentsTable } from './platform-appointments.table';

type Option = { value: string; label: string };

/** A picker whose list cannot be read is left empty; the other pickers, and the list, stand. */
const orEmpty = <T>(): OperatorFunction<T[], T[]> => catchError(() => of([]));

/**
 * «Записи»: the наскрізний список of the whole platform, found by date, status, Салон, Майстер or
 * Клієнт.
 *
 * Which of two reads answers depends on whether anybody is named. Named, the list is a window of the
 * platform's days read from that one's own partition — the Клієнт's, the Майстер's or the Салон's,
 * the narrowest the view names — and it answers at once. Nobody named, the question is «every Запис
 * of the platform», which no index can answer: the page then shows one day at a time, gathered by
 * the backend off the request path (`app-appointments-day`). Either way the view lives in the
 * address, and a row opens into the whole Запис with the actions over it.
 *
 * The pickers are fed by the cached lists the Салони, Незалежні майстри and Клієнти screens already
 * load. The Майстер one offers the Ростер of the chosen Салон, or — with none chosen — the Незалежні
 * майстри: a Майстер салону is found through his Салон, as everywhere else in the panel.
 */
@Component({
  selector: 'app-appointments-page',
  imports: [
    AppointmentsDaySection,
    FormsModule,
    InputText,
    PlatformAppointmentsTable,
    Select,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointments.page.html',
})
export class AppointmentsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly appointments = inject(AppointmentsClient);
  private readonly roster = inject(SalonMastersClient);
  private readonly independentMasters = inject(MastersClient);

  protected readonly filters = signal<PlatformAppointmentFilters | null>(null);
  protected readonly scoped = computed(() => {
    const filters = this.filters();
    return filters !== null && isScoped(filters);
  });

  /** The narrowed list's answer — `null` while it loads, and whenever the view is a day instead. */
  protected readonly items = signal<VenueAppointment[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly statusOptions = computed(() =>
    APPOINTMENT_STATUSES.map((value) => ({
      value,
      label: this.i18n.t(`appointments.status.${value}`),
    })),
  );

  protected readonly salonOptions = toSignal(
    inject(SalonsClient)
      .list()
      .pipe(
        map((list): Option[] =>
          list.items.map((salon) => ({ value: salon.salonId, label: salon.name || salon.salonId })),
        ),
        orEmpty<Option>(),
      ),
    { initialValue: [] },
  );

  /**
   * A Клієнт is looked up from a support request, which may name him by phone or email as often as
   * by name — so the picker's filter matches all three.
   */
  protected readonly clientOptions = toSignal(
    inject(ClientsClient)
      .list()
      .pipe(
        map((list): Option[] =>
          list.items.map((client) => ({
            value: client.clientId,
            label:
              [client.name, client.email, client.phone].filter(Boolean).join(' · ') ||
              client.clientId,
          })),
        ),
        orEmpty<Option>(),
      ),
    { initialValue: [] },
  );

  private readonly chosenSalon = computed(() => this.filters()?.salonId ?? null);

  /** The chosen Салон's Ростер, or the Незалежні майстри when no Салон is chosen. */
  protected readonly masterOptions = toSignal(
    toObservable(this.chosenSalon).pipe(
      distinctUntilChanged(),
      switchMap((salonId) =>
        (salonId
          ? this.roster.roster(salonId).pipe(
              map((roster): Option[] =>
                roster.items.map((master) => ({
                  value: master.masterId,
                  label: master.masterName || master.masterId,
                })),
              ),
            )
          : this.independentMasters.list().pipe(
              map((list): Option[] =>
                list.items.map((master) => ({
                  value: master.masterId,
                  label: master.name || master.masterId,
                })),
              ),
            )
        ).pipe(orEmpty<Option>()),
      ),
    ),
    { initialValue: [] },
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          params,
          asked: parsePlatformAppointmentFilters(params, venueToday(PLATFORM_TIME_ZONE)),
        })),
        // An address that names no view, or one the backend would refuse, is rewritten to the view
        // actually shown — so a copied link reopens this view, not a refusal.
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
          this.items.set(null);
          this.failed.set(false);
        }),
        // A new view starts the list over; the answer to the old one is dropped. A day is the day
        // section's to read, not this one's.
        switchMap(({ asked }) => {
          const query = toApiQuery(asked);
          return query
            ? this.appointments
                .platform(query)
                // The interceptor has already worded the refusal as a toast.
                .pipe(catchError(() => (this.failed.set(true), EMPTY)))
            : EMPTY;
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((page) => this.items.set(page.items));
  }

  /**
   * Who the list is narrowed to. Another Салон has another Ростер, so choosing one lets go of the
   * Майстер. Moving between the two views drops the days of the one left: a day of the platform is
   * not a window, and a window is not a day — each view opens on its own default instead.
   */
  protected pick(
    change: Partial<Pick<PlatformAppointmentFilters, 'salonId' | 'masterId' | 'clientId'>>,
  ): void {
    const current = this.filters();
    if (!current) {
      return;
    }
    const next = {
      ...current,
      ...('salonId' in change ? { masterId: null } : {}),
      ...change,
    };
    const staysScoped = isScoped(current) && isScoped(next);
    const staysDay = !isScoped(current) && !isScoped(next);
    this.navigate({
      ...next,
      date: staysDay ? current.date : null,
      from: staysScoped ? current.from : null,
      to: staysScoped ? current.to : null,
    });
  }

  protected setFilter(
    change: Partial<Pick<PlatformAppointmentFilters, 'date' | 'from' | 'to' | 'status'>>,
  ): void {
    const current = this.filters();
    if (current) {
      // A cleared date input reports '' and a cleared select `null`; `toQueryParams` turns both
      // into a parameter the router drops, which falls back to the view's default.
      this.navigate({ ...current, ...change });
    }
  }

  private navigate(filters: PlatformAppointmentFilters): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(filters) });
  }
}
