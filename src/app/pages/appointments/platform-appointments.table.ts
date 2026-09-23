import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Tag } from 'primeng/tag';
import {
  APPOINTMENT_STATUS_SEVERITY,
  type VenueAppointment,
} from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { AppointmentDetailsPanel } from '../../shared/appointments/appointment-details';
import { isStaleBooking } from '../../shared/appointments/appointment-filters';
import { AppointmentInteraction } from '../../shared/appointments/appointment-interaction';
import { appointmentStatusLabel, formatPrice } from '../../shared/appointments/appointment-wording';
import { formatVenueDateTime } from '../../shared/venue-date';

/**
 * The rows of the наскрізний список — whichever read produced them, a narrowed window or a
 * gathered day — each opening into the whole Запис with the actions over it.
 *
 * Every row carries its own venue and its own clock: the list spans venues, so there is no one
 * clock to print the page on, and an hour is printed as both sides of that Запис remember it.
 *
 * Which Запис is open, its read and where an action's answer lands belong to
 * `AppointmentInteraction`, exactly as on a card's Записи tab: a Запис just cancelled under a
 * «заброньовано» filter stays under the card still showing it instead of vanishing. Every list
 * handed in is a new one — another window, another day, a new gathering, another status — and
 * starts from what it says; the same list handed in again, as a poll of the same gathering hands
 * it, is not handed in anew.
 */
@Component({
  selector: 'app-platform-appointments-table',
  imports: [AppointmentDetailsPanel, Tag, TranslatePipe],
  providers: [AppointmentInteraction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="profile-table-scroll" tabindex="0" role="region" [attr.aria-label]="'nav.appointments' | t">
      <table class="profile-data-table appointments-table">
        <thead class="text-xs text-muted">
          <tr class="border-b border-divider">
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.when' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'client.appointments.column.venue' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.client' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.master' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.services' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.price' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.status' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.appointment.appointmentId) {
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
                <p class="text-xs text-muted" data-testid="appointment-row-timezone">
                  {{ row.appointment.timezone }}
                </p>
                @if (row.stale) {
                  <p class="text-xs text-warning whitespace-normal" data-testid="appointment-row-stale">
                    {{ 'appointments.stale' | t }}
                  </p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-venue">
                {{ row.appointment.venueName || '—' }}
                @if (!row.appointment.salonId) {
                  <p class="text-xs text-muted">{{ 'appointments.details.independent' | t }}</p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-client">
                {{ row.appointment.clientName || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-master">
                {{ row.appointment.masterName || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-services">
                {{ row.services }}
                @if (row.appointment.isManual) {
                  <p-tag
                    class="ml-2"
                    severity="warn"
                    data-testid="appointment-row-manual"
                    [value]="'appointments.manual' | t"
                  />
                }
              </td>
              <td class="px-4 py-3 whitespace-nowrap" data-testid="appointment-row-price">
                {{ row.price }} {{ row.appointment.currency }}
              </td>
              <td class="px-4 py-3">
                <p-tag
                  data-testid="appointment-row-status"
                  [severity]="row.statusSeverity"
                  [value]="row.status"
                />
              </td>
            </tr>
            @if (open) {
              <tr
                class="border-b border-divider bg-raised"
                data-testid="appointment-details"
              >
                <td></td>
                <td class="px-4 py-4" colspan="7">
                  @if (interaction.opened()?.details; as details) {
                    <app-appointment-details [details]="details" />
                  } @else if (interaction.opened()?.failed) {
                    <p class="text-muted" data-testid="appointment-details-failed">
                      {{ 'card.failed' | t }}
                    </p>
                  } @else {
                    <p class="text-muted" data-testid="appointment-details-loading">
                      {{ 'appointments.details.loading' | t }}
                    </p>
                  }
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td
                colspan="8"
                class="py-8 text-center text-muted"
                data-testid="appointments-empty"
              >
                {{ emptyKey() | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-2 max-w-6xl text-xs text-muted" data-testid="appointments-readonly">
      {{ 'appointments.readonly' | t }}
    </p>
  `,
})
export class PlatformAppointmentsTable {
  readonly appointments = input.required<VenueAppointment[]>();
  /** What an empty list says — «за цей період» or «цього дня». */
  readonly emptyKey = input<TranslationKey>('appointments.empty');

  protected readonly interaction: AppointmentInteraction<VenueAppointment> =
    inject(AppointmentInteraction);

  private readonly i18n = inject(I18nService);

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const money = new Intl.NumberFormat(locale);
    const now = new Date();
    return (this.interaction.rows() ?? []).map((appointment) => ({
      appointment,
      // Each row on the clock its own Запис was booked under: this list spans venues.
      when: formatVenueDateTime(appointment.startTime, locale, appointment.timezone),
      services: appointment.serviceNames.join(', ') || '—',
      price: formatPrice(money, appointment.totalPrice),
      status: appointmentStatusLabel(this.i18n, appointment.status),
      statusSeverity: APPOINTMENT_STATUS_SEVERITY[appointment.status] ?? 'secondary',
      // A Запис still «заброньовано» whose time has passed: nobody closed it.
      stale: isStaleBooking(appointment, now),
    }));
  });

  constructor() {
    // Every list handed in is a new one: the Запис open in the last closes, and nothing asked
    // there reaches this one. A poll of the same gathering hands the same list, so it is not seen.
    effect(() => {
      const appointments = this.appointments();
      untracked(() => this.interaction.show(appointments));
    });
  }
}
