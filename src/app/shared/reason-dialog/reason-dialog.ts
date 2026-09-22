import { ChangeDetectionStrategy, Component, computed, effect, input, model, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';

export const REASON_MAX_LENGTH = 500;

/**
 * The «дія з причиною» dialog every heavy action goes through — removal from the Ростер, blocking,
 * hiding a review, cancelling a Запис. The reason is mandatory by default: confirming stays
 * disabled until there is one, and what comes out is already trimmed.
 *
 * `reasonRequired: false` is for the few actions that only close something that already happened —
 * marking a Запис «завершено» or «не з'явився». They still ask, because neither can be undone, but
 * an explanation is not owed to anyone the way a cancellation's is.
 *
 * The dialog does not perform the action. The caller does, keeps `busy` true meanwhile, and closes
 * the dialog (`visible`) on success; on a refusal it stays open with the reason as typed.
 */
@Component({
  selector: 'app-reason-dialog',
  imports: [ReactiveFormsModule, ButtonDirective, Dialog, Textarea, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="!busy()"
      [closable]="!busy()"
      [closeOnEscape]="!busy()"
      [header]="titleKey() | t"
      [style]="{ width: '32rem' }"
      [(visible)]="visible"
    >
      <div class="flex flex-col gap-3 text-sm" data-testid="reason-dialog">
        <p class="text-slate-700" data-testid="reason-message"><ng-content /></p>
        <label class="text-slate-500" for="reason-input">
          {{ (reasonRequired() ? 'reasonDialog.reason' : 'reasonDialog.reasonOptional') | t }}
        </label>
        <textarea
          pTextarea
          id="reason-input"
          data-testid="reason-input"
          rows="4"
          [maxlength]="maxLength"
          [formControl]="reason"
        ></textarea>
      </div>
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="reason-cancel"
          [text]="true"
          [label]="'reasonDialog.cancel' | t"
          [disabled]="busy()"
          (click)="visible.set(false)"
        ></button>
        <button
          pButton
          type="button"
          data-testid="reason-confirm"
          [severity]="confirmSeverity()"
          [label]="confirmLabelKey() | t"
          [disabled]="!canConfirm()"
          [loading]="busy()"
          (click)="confirm()"
        ></button>
      </ng-template>
    </p-dialog>
  `,
})
export class ReasonDialog {
  readonly visible = model(false);
  readonly titleKey = input.required<TranslationKey>();
  readonly confirmLabelKey = input.required<TranslationKey>();
  /** Most heavy actions take something away; lifting a Блокування does not. */
  readonly confirmSeverity = input<'danger' | 'primary'>('danger');
  /** The action is in flight: nothing can be confirmed twice or dismissed from under it. */
  readonly busy = input(false);
  /** `false` lets the action be confirmed with the field left blank — see the note above. */
  readonly reasonRequired = input(true);

  /** The trimmed reason; empty only when this dialog does not require one. */
  readonly confirmed = output<string>();

  protected readonly maxLength = REASON_MAX_LENGTH;
  protected readonly reason = new FormControl('', { nonNullable: true });
  private readonly typed = toSignal(this.reason.valueChanges, { initialValue: '' });
  protected readonly canConfirm = computed(
    () => !this.busy() && (!this.reasonRequired() || this.typed().trim().length > 0),
  );

  constructor() {
    // Every opening starts blank: a reason typed for one action must not leak into the next.
    effect(() => {
      if (this.visible()) {
        this.reason.reset();
      }
    });
  }

  protected confirm(): void {
    if (this.canConfirm()) {
      this.confirmed.emit(this.reason.value.trim());
    }
  }
}
