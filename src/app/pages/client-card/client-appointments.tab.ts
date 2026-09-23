import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import {
  APPOINTMENT_STATUS_SEVERITY,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
  type VenueAppointment,
} from '../../core/api/appointments.client';
import { ClientsClient } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { AppointmentDetailsPanel } from '../../shared/appointments/appointment-details';
import { AppointmentInteraction } from '../../shared/appointments/appointment-interaction';
import { appointmentStatusLabel, formatPrice } from '../../shared/appointments/appointment-wording';
import { isStaleBooking } from '../../shared/appointments/appointment-filters';
import { feed } from '../../shared/feed';
import { formatVenueDateTime } from '../../shared/venue-date';
import { ClientCardStore } from './client-card.store';

/**
 * Записи of one Клієнт — everywhere he has ever booked, newest first, each row opening into the
 * whole Запис.
 *
 * It is **not** the shared Записи tab of a card, and the difference is the point. That one asks for
 * a window of one venue's calendar and prints every row on that venue's clock; this feed spans
 * places, so there is no one clock for the page and the venue travels on the row. It is also not
 * cut by dates at all: a person's own history is already the bound, and the backend's sort key
 * means two different moments depending on whether a Запис is still open — so the feed pages by
 * cursor and «показати давніші» is how it is read further.
 *
 * A Запис is never **made** here, and the actions over one are the Запис's own card, exactly as on
 * a Салон's tab: which Запис is open, its read and where an action's answer lands belong to
 * `AppointmentInteraction`. Another Клієнт or another status is a new list; an older page is the
 * same list read further.
 */
@Component({
  selector: 'app-client-appointments-tab',
  imports: [AppointmentDetailsPanel, ButtonDirective, FormsModule, Select, Tag, TranslatePipe],
  providers: [AppointmentInteraction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="appointment-filters mb-4 flex flex-wrap items-end gap-3">
      <p-select
        data-testid="appointments-filter-status"
        class="w-52"
        optionLabel="label"
        optionValue="value"
        [options]="statusOptions()"
        [showClear]="true"
        [placeholder]="'appointments.filter.status' | t"
        [ariaLabel]="'appointments.filter.status' | t"
        [ngModel]="status()"
        (ngModelChange)="status.set($event)"
      />
    </div>

    @if (rows(); as rows) {
      <div class="profile-table-scroll" tabindex="0" role="region" [attr.aria-label]="'nav.appointments' | t"><table class="profile-data-table appointments-table">
        <thead class="text-xs text-muted">
          <tr class="border-b border-divider">
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.when' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'client.appointments.column.venue' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.master' | t }}</th>
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
                <p class="text-xs text-muted" data-testid="appointment-row-timezone">{{ row.timezone }}</p>
                @if (row.stale) {
                  <p class="text-xs text-warning whitespace-normal" data-testid="appointment-row-stale">
                    {{ 'appointments.stale' | t }}
                  </p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-venue">{{ row.appointment.venueName || '—' }}</td>
              <td class="px-4 py-3" data-testid="appointment-row-master">{{ row.appointment.masterName || '—' }}</td>
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
                <p-tag data-testid="appointment-row-status" [severity]="row.statusSeverity" [value]="row.status" />
              </td>
            </tr>
            @if (open) {
              <tr class="border-b border-divider bg-raised" data-testid="appointment-details">
                <td></td>
                <td class="px-4 py-4" colspan="6">
                  @if (interaction.opened()?.details; as details) {
                    <app-appointment-details [details]="details" />
                  } @else if (interaction.opened()?.failed) {
                    <p class="text-muted" data-testid="appointment-details-failed">{{ 'card.failed' | t }}</p>
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
              <td colspan="7" class="py-8 text-center text-muted" data-testid="appointments-empty">
                {{ 'appointments.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table></div>
      <p class="mt-2 max-w-6xl text-xs text-muted" data-testid="appointments-readonly">
        {{ 'appointments.readonly' | t }}
      </p>
      @if (appointments.hasMore()) {
        <div class="mt-3">
          <button
            pButton
            type="button"
            severity="secondary"
            size="small"
            data-testid="appointments-more"
            [label]="'history.more' | t"
            [loading]="appointments.loading()"
            (click)="appointments.loadMore()"
          ></button>
        </div>
      }
    } @else if (appointments.failed()) {
      <p class="text-muted" data-testid="appointments-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class ClientAppointmentsTab {
  private readonly clients = inject(ClientsClient);
  private readonly card = inject(ClientCardStore);
  private readonly i18n = inject(I18nService);

  protected readonly interaction: AppointmentInteraction<VenueAppointment> =
    inject(AppointmentInteraction);

  /** The one narrowing this feed offers; kept in the component, since the feed has no window. */
  protected readonly status = signal<AppointmentStatus | null>(null);

  /**
   * Whose history, narrowed how. Read from the card as it opens and reopens, not once: another
   * Клієнт is another list even where the card keeps this tab standing between the two.
   */
  private readonly asked = computed(
    () => {
      const clientId = this.card.client()?.clientId;
      return clientId ? { clientId, status: this.status() } : null;
    },
    {
      equal: (left, right) => left?.clientId === right?.clientId && left?.status === right?.status,
    },
  );

  /**
   * Another Клієнт or another status starts the feed over, and a page asked for the old one is
   * dropped; an older page is the same list read further.
   */
  protected readonly appointments = feed({
    query: this.asked,
    read: ({ clientId, status }, cursor) => this.clients.appointments(clientId, { status, cursor }),
    list: this.interaction,
  });

  protected readonly statusOptions = computed(() =>
    APPOINTMENT_STATUSES.map((value) => ({ value, label: this.i18n.t(`appointments.status.${value}`) })),
  );

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const money = new Intl.NumberFormat(locale);
    const now = new Date();
    return (
      this.interaction.rows()?.map((appointment) => ({
        appointment,
        // Each row on the clock its own Запис was booked under: this feed spans venues.
        when: formatVenueDateTime(appointment.startTime, locale, appointment.timezone),
        timezone: appointment.timezone,
        services: appointment.serviceNames.join(', ') || '—',
        price: formatPrice(money, appointment.totalPrice),
        status: appointmentStatusLabel(this.i18n, appointment.status),
        statusSeverity: APPOINTMENT_STATUS_SEVERITY[appointment.status] ?? 'secondary',
        // A Запис still «заброньовано» whose time has passed: nobody closed it.
        stale: isStaleBooking(appointment, now),
      })) ?? null
    );
  });
}
