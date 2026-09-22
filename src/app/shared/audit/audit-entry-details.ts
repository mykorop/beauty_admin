import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { AuditEntry } from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { serviceCategoryLabel } from '../service-category';
import { specializationLabel } from '../specialization';
import { weekdayName } from '../weekday';
import { formatCalendarDate, formatPeriod, TIME_OFF_TYPE_KEYS } from '../working-schedule/time-off';

/**
 * What one Журнал дій entry did: the old and new value of every changed field — in full, PII
 * included — the reason, and for a bulk action everything it touched. Shared by the «Історія» tab
 * of a card and the «Журнал дій» screen, so the two cannot word the same row differently.
 */
@Component({
  selector: 'app-audit-entry-details',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entry().changes.length > 0) {
      <table class="w-full table-fixed text-left">
        <thead class="text-xs text-slate-500">
          <tr>
            <th class="w-1/4 py-1 font-normal">{{ 'history.field' | t }}</th>
            <th class="py-1 font-normal">{{ 'history.before' | t }}</th>
            <th class="py-1 font-normal">{{ 'history.after' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (change of entry().changes; track change.field) {
            <tr class="border-t border-slate-100 align-top" data-testid="history-change">
              <td class="py-1 pr-3">{{ fieldLabel(change.field) }}</td>
              <td class="py-1 pr-3 break-words whitespace-pre-line text-slate-500">
                {{ display(change.before, change.field) }}
              </td>
              <td class="py-1 break-words whitespace-pre-line">{{ display(change.after, change.field) }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
    @if (entry().reason; as reason) {
      <p class="mt-2 text-slate-600" data-testid="history-reason">{{ 'history.reason' | t: { reason } }}</p>
    }
    @if (affected().length > 0) {
      <div class="mt-2" data-testid="history-affected">
        <p class="text-slate-600">{{ 'history.affected' | t: { count: affected().length } }}</p>
        <ul class="mt-1 list-inside list-disc">
          @for (entity of affected(); track entity.type + ':' + entity.id) {
            <li data-testid="history-affected-entity">{{ typeLabel(entity.type) }} {{ entity.id }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class AuditEntryDetails {
  private readonly i18n = inject(I18nService);

  readonly entry = input.required<AuditEntry>();
  protected readonly affected = computed(() => this.entry().affected ?? []);

  /** A field is named as its card's own tab names it; anything else keeps its raw path. */
  protected fieldLabel(field: string): string {
    const day = HOURS_FIELD.exec(field);
    if (day) {
      const [, dayOfWeek, part] = day;
      return [
        // The same `hours.<day>` path names a Салон's Години роботи and a Майстер's тижневі години.
        this.i18n.t(this.entry().action === 'salon.master.hours.update' ? 'schedule.week.title' : 'salon.field.hours'),
        weekdayName(this.i18n.locale(), Number(dayOfWeek)),
        ...(part ? [this.i18n.optional(`salon.field.hours.${part}`) ?? part] : []),
      ].join(' · ');
    }
    // `appointments.<appointmentId>.<field>` — a Запис one of the panel's actions moved. The id
    // stays in the label, unlike the Каталог's: a масове скасування writes one row per Запис, and
    // without it they would be a column of identical lines.
    const appointment = APPOINTMENT_FIELD.exec(field);
    if (appointment) {
      const [, appointmentId, part] = appointment;
      return [
        `${this.i18n.t('appointments.auditField')} ${appointmentId}`,
        this.i18n.optional(`appointments.field.${part}`) ?? part,
      ].join(' · ');
    }
    // `reviews.<reviewId>.<field>` — a відгук the panel hid or returned. The id stays in the
    // label for the same reason the Запис's does: it is the only thing that tells two rows apart.
    const review = REVIEW_FIELD.exec(field);
    if (review) {
      const [, reviewId, part] = review;
      return [
        `${this.i18n.t('reviews.auditField')} ${reviewId}`,
        this.i18n.optional(`reviews.field.${part}`) ?? part,
      ].join(' · ');
    }
    const service = SERVICE_FIELD.exec(field);
    if (service) {
      const part = service[1];
      return [
        this.i18n.t('services.auditField'),
        ...(part ? [this.i18n.optional(`services.field.${part}`) ?? part] : []),
      ].join(' · ');
    }
    // `timeOff.<groupId>`: the id names nothing a reader knows — the value beside it has the period.
    if (TIME_OFF_FIELD.test(field)) {
      return this.i18n.t('master.field.timeOff');
    }
    const key = `${this.entry().targetType}.field.${FIELD_LABEL_ALIASES[field] ?? field}`;
    return this.i18n.optional(key) ?? field;
  }

  protected typeLabel(type: string): string {
    return this.i18n.optional(`audit.targetType.${type}`) ?? type;
  }

  protected display(value: unknown, field?: string): string {
    // An emptied list — the windows of a day that closed — reads as nothing, like an emptied field.
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return this.i18n.t(value ? 'audit.value.yes' : 'audit.value.no');
    }
    if (field === 'specialization' && typeof value === 'string') {
      return specializationLabel(this.i18n, value);
    }
    // The states of a Запис are wording the panel already owns; the log must not be the one screen
    // that prints them raw.
    if (field?.startsWith('appointments.') && field.endsWith('.status') && typeof value === 'string') {
      return this.i18n.optional(`appointments.status.${value}`) ?? value;
    }
    if (field?.endsWith('.category') && SERVICE_FIELD.test(field) && typeof value === 'string') {
      return serviceCategoryLabel(this.i18n, value);
    }
    if (isService(value)) {
      return [
        value.name,
        ...(value.category === undefined ? [] : [serviceCategoryLabel(this.i18n, value.category)]),
        this.i18n.t('services.value.minutes', { count: value.durationMinutes }),
        `${value.price} ${value.currency}`,
      ].join(' · ');
    }
    if (field === 'schedulePattern.anchorDate' && typeof value === 'string') {
      return formatCalendarDate(value, this.i18n.locale());
    }
    if (field === 'schedulePattern.workingOffsets' && isCycleDays(value)) {
      return cycleDays(value);
    }
    if (isRotation(value)) {
      return this.i18n.t('rotation.summary', {
        length: value.cycleLength,
        days: cycleDays(value.workingOffsets),
        date: formatCalendarDate(value.anchorDate, this.i18n.locale()),
      });
    }
    if (isTimeOff(value)) {
      return [
        this.i18n.t(TIME_OFF_TYPE_KEYS[value.type]),
        formatPeriod(value.fromDate, value.toDate, this.i18n.locale()),
        ...(value.slots?.length ? [this.display(value.slots)] : []),
        ...(value.reason ? [value.reason] : []),
      ].join(' · ');
    }
    if (isHoursDay(value)) {
      return value.isOpen && value.slots.length > 0 ? this.display(value.slots) : this.i18n.t('hours.closed');
    }
    if (isSlots(value)) {
      return value.map((slot) => `${slot.start} – ${slot.end}`).join('\n');
    }
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }
}

/** `hours.<dayOfWeek>` or `hours.<dayOfWeek>.<isOpen|slots>` — a day of a week of Години роботи. */
const HOURS_FIELD = /^hours\.([0-6])(?:\.(\w+))?$/;

/**
 * `services.<serviceId>` (one added or removed) or `services.<serviceId>.<field>` — the Каталог
 * послуг of a salon, or the Копії of a master.
 */
const SERVICE_FIELD = /^services\.[^.]+(?:\.(\w+))?$/;

/** `appointments.<appointmentId>.<field>` — one Запис moved by an action of the panel. */
const APPOINTMENT_FIELD = /^appointments\.([^.]+)\.(\w+)$/;

/** `reviews.<reviewId>.<field>` — one відгук hidden or returned by the panel. */
const REVIEW_FIELD = /^reviews\.([^.]+)\.(\w+)$/;

/** `timeOff.<groupId>` — one Відсутність, filed or removed whole. */
const TIME_OFF_FIELD = /^timeOff\.[^.]+$/;

type Slot = { start: string; end: string };

const isCycleDays = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length > 0 && value.every((offset) => typeof offset === 'number');

/** Positions of a cycle as its editor numbers them: from 1. */
const cycleDays = (offsets: number[]): string => offsets.map((offset) => offset + 1).join(', ');

type Rotation = { anchorDate: string; cycleLength: number; workingOffsets: number[] };

/** A whole Ротація as one value — the «after» of one set, the «before» of one removed. */
const isRotation = (value: unknown): value is Rotation => {
  const rotation = value as Partial<Rotation> | null;
  return (
    typeof rotation === 'object' &&
    rotation !== null &&
    typeof rotation.anchorDate === 'string' &&
    typeof rotation.cycleLength === 'number' &&
    isCycleDays(rotation.workingOffsets)
  );
};

type TimeOff = {
  type: keyof typeof TIME_OFF_TYPE_KEYS;
  fromDate: string;
  toDate: string;
  slots?: Slot[];
  reason?: string;
};

/** A whole Відсутність as one value — the «after» of one filed, the «before» of one removed. */
const isTimeOff = (value: unknown): value is TimeOff => {
  const timeOff = value as Partial<TimeOff> | null;
  return (
    typeof timeOff === 'object' &&
    timeOff !== null &&
    typeof timeOff.type === 'string' &&
    timeOff.type in TIME_OFF_TYPE_KEYS &&
    typeof timeOff.fromDate === 'string' &&
    typeof timeOff.toDate === 'string'
  );
};

const isSlots = (value: unknown): value is Slot[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((slot: Partial<Slot> | null) => typeof slot?.start === 'string' && typeof slot.end === 'string');

/** A Копія майстра is logged without the Каталог's category. */
type Service = { name: string; category?: string; durationMinutes: number; price: number; currency: string };

/** A whole послуга as one value — the «after» of an added one, the «before» of a removed Копія. */
const isService = (value: unknown): value is Service => {
  const service = value as Partial<Service> | null;
  return (
    typeof service === 'object' &&
    service !== null &&
    typeof service.name === 'string' &&
    (service.category === undefined || typeof service.category === 'string') &&
    typeof service.durationMinutes === 'number' &&
    typeof service.price === 'number' &&
    typeof service.currency === 'string'
  );
};

const isHoursDay = (value: unknown): value is { isOpen: boolean; slots: Slot[] } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { isOpen?: unknown }).isOpen === 'boolean' &&
  Array.isArray((value as { slots?: unknown }).slots);

/** Row attributes whose label on the card lives under another name. */
const FIELD_LABEL_ALIASES: Record<string, string> = {
  bufferMinutes: 'buffer',
  bookingForwardDays: 'bookingHorizon',
};
