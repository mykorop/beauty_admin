import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import type { AppointmentsConflict } from './appointments-conflict';
import { formatCalendarDate } from './time-off';

/**
 * Live Записи standing in the way of a change of the Робочий графік, named on the spot: how many,
 * on which days, and the button that sends the same change again over them. The host says which
 * change it is — in its own sentence and button — and sends it: this only asks. Nothing is
 * cancelled on either answer, and no Клієнт is told.
 */
@Component({
  selector: 'app-appointments-conflict',
  imports: [ButtonDirective, Message, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-message class="block" severity="warn" icon="pi pi-exclamation-triangle">
      <div [attr.data-testid]="testId() + '-conflict'">
        <p>{{ message() | t: { count: conflict().appointmentCount, dates: dates() } }}</p>
        <button
          pButton
          type="button"
          class="mt-2"
          size="small"
          severity="warn"
          [attr.data-testid]="testId() + '-confirm'"
          [label]="confirmLabel() | t"
          [loading]="busy()"
          (click)="confirm.emit()"
        ></button>
      </div>
    </p-message>
  `,
})
export class AppointmentsConflictView {
  private readonly i18n = inject(I18nService);

  readonly conflict = input.required<AppointmentsConflict>();
  /** The host's sentence, with `{{count}}` and `{{dates}}`. */
  readonly message = input.required<TranslationKey>();
  readonly confirmLabel = input.required<TranslationKey>();
  readonly busy = input(false);
  /** `<testId>-conflict` on the sentence, `<testId>-confirm` on the button. */
  readonly testId = input.required<string>();

  /** The administrator has seen the Записи, and makes the change with them left where they are. */
  readonly confirm = output<void>();

  protected readonly dates = computed(() => {
    const locale = this.i18n.locale();
    return this.conflict()
      .dates.map((date) => formatCalendarDate(date, locale))
      .join(', ');
  });
}
