import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Tag } from 'primeng/tag';
import { APPOINTMENT_STATUS_SEVERITY, type AppointmentDetails } from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { formatVenueDateTime } from '../venue-date';
import { AppointmentActions } from './appointment-actions';
import { appointmentStatusLabel, formatPrice } from './appointment-wording';

/**
 * One Запис in full, under the row it was opened from — everything a disputed booking is read for:
 * Клієнт, Майстер, Салон, послуги з цінами, час у поясі закладу, статус, нотатки and whether the
 * business added it by hand.
 *
 * The clock is the Запис's own: the one both sides agreed on when it was made, which is not always
 * the venue's today (a Салон may have moved zones since).
 *
 * The actions the administrator may take over it sit at the foot of the same panel — reading a
 * disputed Запис and deciding what to do about it is one act, not two screens.
 */
@Component({
  selector: 'app-appointment-details',
  imports: [AppointmentActions, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as view) {
      <div class="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        <div>
          <p class="text-xs text-slate-500">{{ 'appointments.details.client' | t }}</p>
          <p class="font-medium" data-testid="appointment-details-client">{{ view.clientName }}</p>
          <p class="text-slate-600" data-testid="appointment-details-phone">{{ view.clientPhone }}</p>
          @if (!view.details.clientId) {
            <p class="text-xs text-slate-500" data-testid="appointment-details-walk-in">
              {{ 'appointments.details.walkIn' | t }}
            </p>
          }
        </div>
        <div>
          <p class="text-xs text-slate-500">{{ 'appointments.details.when' | t }}</p>
          <p class="font-medium" data-testid="appointment-details-when">{{ view.start }} – {{ view.end }}</p>
          <p class="text-slate-600">
            {{ 'services.value.minutes' | t: { count: view.details.totalDurationMinutes } }} ·
            {{ view.timezone }}
          </p>
        </div>
        <div>
          <p class="text-xs text-slate-500">{{ 'appointments.details.master' | t }}</p>
          <p class="font-medium" data-testid="appointment-details-master">{{ view.details.masterName || '—' }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">{{ 'appointments.details.salon' | t }}</p>
          <p class="font-medium" data-testid="appointment-details-salon">
            {{ view.details.salonName || ('appointments.details.independent' | t) }}
          </p>
        </div>
        <div class="sm:col-span-2">
          <p class="mb-1 text-xs text-slate-500">{{ 'appointments.details.services' | t }}</p>
          <table class="w-full max-w-xl text-left">
            <tbody>
              @for (service of view.services; track service.serviceId) {
                <tr class="border-b border-slate-100 last:border-0" data-testid="appointment-details-service">
                  <td class="py-1">{{ service.name }}</td>
                  <td class="py-1 text-slate-600">
                    {{ 'services.value.minutes' | t: { count: service.durationMinutes } }}
                  </td>
                  <td class="py-1 text-right">{{ service.price }} {{ view.details.currency }}</td>
                </tr>
              } @empty {
                <tr>
                  <td class="py-1 text-slate-600" data-testid="appointment-details-no-services">—</td>
                </tr>
              }
              <tr>
                <td class="py-1 font-medium">{{ 'appointments.details.total' | t }}</td>
                <td></td>
                <td class="py-1 text-right font-medium" data-testid="appointment-details-total">
                  {{ view.total }} {{ view.details.currency }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <p class="text-xs text-slate-500">{{ 'appointments.details.status' | t }}</p>
          <p-tag data-testid="appointment-details-status" [severity]="view.statusSeverity" [value]="view.status" />
          @if (view.details.isManual) {
            <p-tag class="ml-2" severity="warn" data-testid="appointment-details-manual" [value]="'appointments.manual' | t" />
          }
        </div>
        <div class="sm:col-span-2">
          <p class="text-xs text-slate-500">{{ 'appointments.details.notes' | t }}</p>
          <p class="whitespace-pre-line" data-testid="appointment-details-notes">
            {{ view.details.notes || ('appointments.details.noNotes' | t) }}
          </p>
        </div>
      </div>

      <app-appointment-actions [details]="view.details" (changed)="changed.emit($event)" />
    }
  `,
})
export class AppointmentDetailsPanel {
  readonly details = input.required<AppointmentDetails>();

  /** The Запис as an action left it — the table above redraws its row from this. */
  readonly changed = output<AppointmentDetails>();

  private readonly i18n = inject(I18nService);

  protected readonly view = computed(() => {
    const details = this.details();
    const locale = this.i18n.locale();
    const money = new Intl.NumberFormat(locale);
    const at = (iso: string) => formatVenueDateTime(iso, locale, details.timezone);
    return {
      details,
      clientName: details.clientName || '—',
      clientPhone: details.clientPhone || '—',
      timezone: details.timezone,
      start: at(details.startTime),
      end: at(details.endTime),
      services: details.services.map((service) => ({ ...service, price: formatPrice(money, service.price) })),
      total: formatPrice(money, details.totalPrice),
      status: appointmentStatusLabel(this.i18n, details.status),
      statusSeverity: APPOINTMENT_STATUS_SEVERITY[details.status] ?? 'secondary',
    };
  });
}
