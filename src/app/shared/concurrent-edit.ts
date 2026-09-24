import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type AbstractControl, FormControl, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import type { Observable } from 'rxjs';
import { refusalMessage } from '../core/api/admin-api.interceptor';
import { ApiError, EDIT_CONFLICT_CODE } from '../core/api/api-error';
import { I18nService } from '../i18n/i18n.service';
import { type DoneToast, doneToasts, SAVED_TOAST } from './done-toast';
import { actionLevel } from './profile-card/card-lifetime';
import { REASON_MAX_LENGTH } from './reason-dialog/reason-dialog';

const NOT_FOUND_CODE = 'NOT_FOUND';

export type ConcurrentEditSource<V, F, P extends object> = {
  /** The form `current` is typed into: what it holds, and whether that is valid, decide a save. */
  form: AbstractControl<unknown, F>;
  /** What the form is open on, as the backend last answered it — `null` for one not created yet. */
  current: Signal<V | null>;
  /** What was typed, as changes against `current`: the fields that differ, and those alone. */
  changes: (current: V, typed: F) => P;
  /**
   * Sends the changes under the `updatedAt` of `current` — or, on a new one (`changes` is `null`),
   * creates it; `null` while there is nothing to send. The answer is what was saved.
   */
  save: (changes: P | null, reason: string | undefined) => Observable<V> | null;
  /** Reads `current` anew: what was saved meanwhile — `null` when it is not there any more. */
  reload: (current: V) => Observable<V | null>;
  /** Types `value` into the form — what a reload brought. */
  fill: (value: V) => void;
  /** Saved: the form is done with. */
  saved: (value: V) => void;
  /** How a save is told, from what was saved and what was typed; «Зміни збережено.» otherwise. */
  toast?: (saved: V, typed: F) => DoneToast;
  /**
   * `current` was removed meanwhile — a save refused with `NOT_FOUND`, or a reload that no longer
   * finds it: there is nothing left to edit. Without it `NOT_FOUND` is a refusal like any other.
   */
  gone?: (current: V) => void;
};

/** A form edited under `updatedAt`, as its buttons and its conflict banner draw it. */
export type ConcurrentEdit<P> = {
  /** The optional reason typed beside the form; sent trimmed, or not at all. */
  readonly reason: FormControl<string>;
  /** What a save would send: the changes against `current` — `null` on a new one, sent whole. */
  readonly changes: Signal<P | null>;
  /** A save or a reload is on its way. */
  readonly busy: Signal<boolean>;
  /** Someone saved in between: the form offers a reload, and saves nothing until then. */
  readonly conflict: Signal<boolean>;
  /** Changed, valid, nothing on its way, no conflict. */
  readonly canSave: Signal<boolean>;
  save(): void;
  /** Drops what was typed and opens the form on what was saved meanwhile. */
  reload(): void;
};

/**
 * An edit of a record that someone else — the Власник салону, the Майстер — may save at the same
 * time: the profile of a Салон or of a Незалежний майстер, a Майстер салону, a service of a
 * Каталог послуг, a Копія майстра.
 *
 * Only what changed is sent, under the `updatedAt` the form is open on, so a save made in between
 * is refused with `EDIT_CONFLICT` instead of being overwritten: the form then says so, and saves
 * nothing more until it is reloaded — the reload drops what was typed and opens it on the fresh
 * record. Any other refusal leaves everything as typed; the interceptor has already worded it. A
 * save that lands is told, and the form is done with it.
 *
 * Bound to the opening of the card the form is on (`actionLevel`): a save or a reload answered
 * after the card opened anew is dropped, and changes nothing there. Made in the form's injection
 * context, after the form itself.
 */
export function concurrentEdit<V, F, P extends object>(
  source: ConcurrentEditSource<V, F, P>,
): ConcurrentEdit<P> {
  const level = actionLevel();
  const tell = doneToasts();
  const messages = inject(MessageService);
  const i18n = inject(I18nService);
  const busy = level.state(false);
  const conflict = level.state(false);
  const reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(REASON_MAX_LENGTH)],
  });

  const typed = toSignal(source.form.valueChanges, { initialValue: source.form.getRawValue() });
  const status = toSignal(source.form.statusChanges, { initialValue: source.form.status });
  const changes = computed(() => {
    typed();
    const current = source.current();
    // Raw: a field disabled on an existing record still says what it holds.
    return current ? source.changes(current, source.form.getRawValue()) : null;
  });
  const canSave = computed(() => {
    const changed = changes();
    return (
      !busy() &&
      !conflict() &&
      status() === 'VALID' &&
      (changed === null || Object.keys(changed).length > 0)
    );
  });

  /** Nothing is left to edit — found by a save, which the interceptor has worded, or by a reload. */
  const vanished = (current: V, found: 'save' | 'reload'): void => {
    if (found === 'reload') {
      messages.add(refusalMessage(i18n, NOT_FOUND_CODE));
    }
    source.gone?.(current);
  };

  return {
    reason,
    changes,
    busy: busy.asReadonly(),
    conflict: conflict.asReadonly(),
    canSave,
    save: () => {
      if (!canSave() || reason.invalid) {
        return;
      }
      const sent = source.form.getRawValue();
      const request = source.save(changes(), reason.value.trim() || undefined);
      if (!request) {
        return;
      }
      busy.set(true);
      level.run(request, {
        next: (saved) => {
          tell(source.toast?.(saved, sent) ?? SAVED_TOAST);
          source.saved(saved);
        },
        error: (error) => {
          const current = source.current();
          if (source.gone && current && refusedWith(error, NOT_FOUND_CODE)) {
            vanished(current, 'save');
            return;
          }
          conflict.set(refusedWith(error, EDIT_CONFLICT_CODE));
        },
        done: () => busy.set(false),
      });
    },
    reload: () => {
      const current = source.current();
      if (!current || busy()) {
        return;
      }
      busy.set(true);
      level.run(source.reload(current), {
        next: (fresh) => {
          if (fresh === null) {
            vanished(current, 'reload');
            return;
          }
          source.fill(fresh);
          conflict.set(false);
        },
        done: () => busy.set(false),
      });
    },
  };
}

function refusedWith(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
