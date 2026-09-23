import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';

export const REASON_MAX_LENGTH = 500;
// A dialog opened from another dialog returns to the original page action.
const dialogOpeners = new WeakMap<Element, HTMLElement>();
let reasonInputSequence = 0;

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
  host: { '(keydown.escape)': 'onEscape($event)' },
  template: `
    <p-dialog
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="!busy()"
      [closable]="!busy()"
      [closeOnEscape]="false"
      [header]="titleKey() | t"
      styleClass="bookme-dark reason-dialog"
      [focusOnShow]="false"
      (onShow)="focusReason()"
      (onHide)="restoreFocus()"
      [visible]="visible()"
      (visibleChange)="onVisibilityChange($event)"
    >
      <div class="flex flex-col gap-3 text-sm" data-testid="reason-dialog">
        <div class="text-ink" data-testid="reason-message"><ng-content /></div>
        <label class="text-muted" [for]="reasonInputId">
          {{ (reasonRequired() ? 'reasonDialog.reason' : 'reasonDialog.reasonOptional') | t }}
        </label>
        <textarea
          pTextarea
          #reasonInput
          [id]="reasonInputId"
          data-testid="reason-input"
          rows="4"
          [maxlength]="maxLength"
          [formControl]="reason"
          [attr.aria-required]="reasonRequired()"
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
  private readonly document = inject(DOCUMENT);
  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');
  private returnFocus: HTMLElement | null = null;
  private returnRegion: HTMLElement | null = null;
  private dialogElement: Element | null = null;
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
  protected readonly reasonInputId = `reason-input-${++reasonInputSequence}`;
  protected readonly reason = new FormControl('', { nonNullable: true });
  private readonly typed = toSignal(this.reason.valueChanges, { initialValue: '' });
  protected readonly canConfirm = computed(
    () => !this.busy() && (!this.reasonRequired() || this.typed().trim().length > 0),
  );

  constructor() {
    // Conditional consumers destroy the component immediately, without PrimeNG's onHide.
    inject(DestroyRef).onDestroy(() => queueMicrotask(() => this.restoreFocus()));
    // Disabling the focused submit button would otherwise move focus out of the modal.
    effect(() => {
      if (this.visible() && this.busy()) this.reasonInput()?.nativeElement.focus();
    });
    // Every opening starts blank: a reason typed for one action must not leak into the next.
    effect(() => {
      if (this.visible()) {
        const active = this.document.activeElement;
        const parentDialog = active?.closest('[role="dialog"]');
        this.returnFocus =
          (parentDialog && dialogOpeners.get(parentDialog)) ||
          (active instanceof HTMLElement ? active : null);
        this.returnRegion = this.returnFocus?.closest('main') ?? null;
        this.reason.reset();
      }
    });
  }

  protected focusReason(): void {
    this.dialogElement = this.reasonInput()?.nativeElement.closest('[role="dialog"]') ?? null;
    if (this.dialogElement && this.returnFocus) {
      dialogOpeners.set(this.dialogElement, this.returnFocus);
    }
    this.reasonInput()?.nativeElement.focus();
  }

  protected onVisibilityChange(visible: boolean): void {
    // PrimeNG binds Escape/backdrop listeners on opening; check live busy state on dismissal.
    if (!this.busy()) this.visible.set(visible);
  }

  protected onEscape(event: Event): void {
    // A toast can sit above the dialog without becoming the active keyboard context.
    event.stopPropagation();
    this.onVisibilityChange(false);
  }

  protected restoreFocus(): void {
    // A successful action may remove its trigger or navigate away. Never steal focus from
    // another dialog (for example the separate upcoming-appointments cancellation).
    const anotherDialog = Array.from(this.document.querySelectorAll('[role="dialog"]')).some(
      (dialog) => dialog !== this.dialogElement,
    );
    if (anotherDialog) return;
    const target = this.returnFocus?.isConnected ? this.returnFocus : this.returnRegion;
    if (target?.isConnected) target.focus();
    this.returnFocus = null;
    this.returnRegion = null;
  }

  protected confirm(): void {
    if (this.canConfirm()) {
      this.confirmed.emit(this.reason.value.trim());
    }
  }
}
