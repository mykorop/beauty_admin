import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ReasonDialog } from '../reason-dialog/reason-dialog';

/**
 * The Блокування control of a profile card: one button, and the «дія з причиною» dialog behind it.
 *
 * It sits in the card's header rather than on a tab because Блокування is about the whole profile,
 * not about what any one tab shows — and because the banner it answers is right beside it. The
 * component performs nothing: the card keeps `busy` true while its own client call is in flight and
 * closes the dialog (`open`) on success, so a refusal leaves the reason exactly as it was typed.
 *
 * Wording is deliberately shared between the Салон and the Незалежний майстер: the sentence names
 * the profile (`subject`) instead of its kind, so there is one set of keys and one description of
 * what a Блокування does.
 */
/**
 * The four keys of each direction, spelled out rather than assembled from a prefix: a built key
 * would need an assertion into `TranslationKey`, and that is exactly the check the key-parity test
 * rests on — a renamed or mistyped key has to fail the compiler, not the screen.
 */
type BlockCopy = Record<'open' | 'title' | 'message' | 'confirm', TranslationKey>;

const BLOCK_COPY: BlockCopy = {
  open: 'block.open',
  title: 'block.title',
  message: 'block.message',
  confirm: 'block.confirm',
};

const UNBLOCK_COPY: BlockCopy = {
  open: 'unblock.open',
  title: 'unblock.title',
  message: 'unblock.message',
  confirm: 'unblock.confirm',
};

@Component({
  selector: 'app-block-action',
  imports: [ButtonDirective, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      pButton
      type="button"
      size="small"
      icon="pi pi-ban"
      data-testid="block-open"
      [outlined]="true"
      [severity]="blocked() ? 'secondary' : 'danger'"
      [label]="openLabelKey() | t"
      (click)="open.set(true)"
    ></button>
    <app-reason-dialog
      [titleKey]="titleKey()"
      [confirmLabelKey]="confirmLabelKey()"
      [confirmSeverity]="blocked() ? 'primary' : 'danger'"
      [busy]="busy()"
      [(visible)]="open"
      (confirmed)="confirmed.emit($event)"
    >
      {{ messageKey() | t: { name: subject() } }}
      @if (upcomingStated()) {
        <span class="mt-2 block font-medium text-warning" data-testid="block-upcoming">
          {{ 'block.upcoming' | t: { count: upcomingCount() } }}
        </span>
        <button
          pButton
          type="button"
          size="small"
          severity="danger"
          class="mt-2"
          data-testid="block-upcoming-cancel"
          [outlined]="true"
          [label]="'block.upcomingCancel' | t"
          [disabled]="busy()"
          (click)="cancelUpcoming.emit()"
        ></button>
      }
    </app-reason-dialog>
  `,
})
export class BlockAction {
  /** The profile carries a Блокування right now, so the action on offer is lifting it. */
  readonly blocked = input.required<boolean>();
  /** The profile's own name, as the dialog names it. */
  readonly subject = input.required<string>();
  /** The card's call is in flight: nothing can be confirmed twice or dismissed from under it. */
  readonly busy = input(false);

  /**
   * How many Записи the profile still has ahead of it, or `null` while it is unknown.
   *
   * Блокування itself cancels nothing — that is the rule, not an omission — so the dialog says so
   * with the number in hand, and the масове скасування stays a separate, deliberate press
   * afterwards. Stated only when there is something to state, and only when blocking: lifting a
   * Блокування puts those Записи back in a profile that can be reached again.
   */
  readonly upcomingCount = input<number | null>(null);

  /** The trimmed, non-empty reason. The intent is `blocked()` at the moment it was confirmed. */
  readonly confirmed = output<string>();

  /**
   * The administrator took the offer: leave Блокування alone and go to the масове скасування.
   *
   * Deliberately an offer and not a checkbox on this dialog. Блокування cancelling nothing is a
   * rule of the domain, and the two decisions are owed separate confirmations with separate
   * reasons — so this one closes this dialog and opens that one rather than bundling them.
   */
  readonly cancelUpcoming = output<void>();

  /** Two-way: the card closes it once its own call has succeeded, and never before. */
  readonly open = model(false);

  protected readonly upcomingStated = computed(
    () => !this.blocked() && (this.upcomingCount() ?? 0) > 0,
  );

  private readonly copy = computed(() => (this.blocked() ? UNBLOCK_COPY : BLOCK_COPY));

  protected readonly openLabelKey = computed(() => this.copy().open);
  protected readonly titleKey = computed(() => this.copy().title);
  protected readonly messageKey = computed(() => this.copy().message);
  protected readonly confirmLabelKey = computed(() => this.copy().confirm);
}
