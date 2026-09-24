import { computed, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { TranslationKey } from '../../i18n/translations';
import { type DoneToast, doneToasts } from '../done-toast';
import { actionLevel } from '../profile-card/card-lifetime';
import type { RequestScope } from '../request-scope';

export type ReasonActionSource<S, T> = {
  /**
   * Sends the action over what the dialog was opened on, with the reason confirmed in it: trimmed,
   * and empty only where the reason is not owed. The answer is the backend's.
   */
  run: (reason: string, subject: S) => Observable<T>;
  /** What the answer changes — the row, the card — before the dialog closes. */
  accept?: (answer: T, subject: S) => void;
  /** How a success is told: its key, or the one the answer calls for. Nothing is told without it. */
  toast?: TranslationKey | ((answer: T, subject: S) => TranslationKey | DoneToast);
  /** Whether a reason is owed — always, unless said otherwise. */
  reasonRequired?: boolean | ((subject: S) => boolean);
  /** The level the action belongs to, when it is a list's rather than the card's (`actionLevel`). */
  scope?: RequestScope;
};

/** A «дія з причиною» as its dialog and its buttons draw it. */
export type ReasonAction<S> = {
  /** What the dialog is open on; `null` while it is closed, and for an action about nothing but itself. */
  readonly asked: Signal<S | null>;
  readonly open: Signal<boolean>;
  /** The action is on its way: it cannot be confirmed twice, and the dialog cannot be dismissed. */
  readonly busy: Signal<boolean>;
  /** Whether the dialog open now owes a reason. */
  readonly reasonRequired: Signal<boolean>;
  /** Opens the dialog on `subject`, with nothing typed. */
  ask(subject: S): void;
  /** Closes the dialog without acting — never while the action is on its way. */
  dismiss(): void;
  /** The reason confirmed in the dialog: sends the action. */
  confirm(reason: string): void;
};

/**
 * A heavy action taken with a reason — Блокування, Масове скасування, closing a Запис, hiding a
 * Відгук, Видалення вмісту, removal from the Ростер. The dialog (`ReasonDialog`) only draws and
 * asks; this is what acts.
 *
 * While the action is on its way nothing can be confirmed again and nothing closes the dialog. The
 * backend agreeing closes it: the answer is taken in first (`accept`), then the success is told. A
 * refusal leaves it open with the reason as typed — the interceptor has already worded it — so it
 * can be corrected and sent again.
 *
 * Bound to the opening of the card the action is taken on (`actionLevel`), or to the list given as
 * `scope`: an answer that lands after either opened anew — another profile, other filters — is
 * dropped, and the dialog and its pending state start over with them. Made in an injection context.
 */
export function reasonAction<S = void, T = unknown>(
  source: ReasonActionSource<S, T>,
): ReasonAction<S> {
  const level = source.scope ?? actionLevel();
  const tell = doneToasts();
  // Wrapped, so that an action about nothing but itself (`S = void`) is open too.
  const opened = level.state<{ subject: S } | null>(null);
  const busy = level.state(false);

  const owed = (subject: S): boolean =>
    typeof source.reasonRequired === 'function'
      ? source.reasonRequired(subject)
      : (source.reasonRequired ?? true);

  const told = (answer: T, subject: S): DoneToast | null => {
    const toast = typeof source.toast === 'function' ? source.toast(answer, subject) : source.toast;
    return typeof toast === 'string' ? { key: toast } : (toast ?? null);
  };

  return {
    asked: computed(() => opened()?.subject ?? null),
    open: computed(() => opened() !== null),
    busy: busy.asReadonly(),
    reasonRequired: computed(() => {
      const shown = opened();
      return shown ? owed(shown.subject) : true;
    }),
    ask: (subject) => {
      if (!busy()) {
        opened.set({ subject });
      }
    },
    dismiss: () => {
      if (!busy()) {
        opened.set(null);
      }
    },
    confirm: (reason) => {
      const shown = opened();
      if (!shown || busy() || (owed(shown.subject) && !reason)) {
        return;
      }
      const { subject } = shown;
      busy.set(true);
      level.run(source.run(reason, subject), {
        next: (answer) => {
          source.accept?.(answer, subject);
          opened.set(null);
          const toast = told(answer, subject);
          if (toast) {
            tell(toast);
          }
        },
        done: () => busy.set(false),
      });
    },
  };
}
