import { computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { exhaustMap, type Observable, type Subscription, takeWhile, timer } from 'rxjs';
import type { TableRun } from '../core/api/table-run.model';

/** How often a screen asks the backend how a run over the whole table is getting on. */
export const TABLE_RUN_POLL_MS = 2000;

/**
 * How far a run over the whole table has got, as a percentage of it — or `null` when there is no
 * estimate to take it of, and the screen shows the count alone. DynamoDB refreshes its estimate
 * every few hours, so the count can outrun it: a run still reading is at most 99%, never «done».
 */
export function runProgress(run: TableRun): number | null {
  if (!run.estimatedItems) {
    return null;
  }
  return Math.min(99, Math.floor((run.scannedItems / run.estimatedItems) * 100));
}

/** What the backend answers about a run: the latest run, beside whatever result its kind keeps. */
type TableRunState = { run: TableRun | null };

/**
 * A run of work the backend does over the whole table, followed from the screen that asked for it
 * — the Детальна статистика on the dashboard, the gathering of a day's Записи on «Записи». Both are
 * followed the same way, so the way lives here once: read the latest state, start a run (the
 * backend hands back the one already under way instead of starting a second), and poll while it
 * reads — waiting out a slow answer rather than cancelling it, and stopping on the first refusal
 * instead of toasting one every two seconds.
 *
 * What the state holds beside the run, and how the screen words it, stay the screen's own.
 *
 * Made in a component's field initializer: it takes the component's `DestroyRef`, so nothing it
 * starts outlives the screen.
 */
export class TableRunFollower<State extends TableRunState> {
  readonly state = signal<State | null>(null);
  /** The state could not be read at all; the interceptor has already worded why. */
  readonly loadFailed = signal(false);
  /** Polling stopped on a refusal — the run may still be reading; a press follows it again. */
  readonly followFailed = signal(false);
  private readonly starting = signal(false);
  /** Polling is under way. */
  private readonly following = signal(false);

  readonly run = computed(() => this.state()?.run ?? null);
  readonly running = computed(() => this.run()?.status === 'running');
  /** The button waits: a start is on its way, or a run it follows is still reading. */
  readonly busy = computed(() => this.starting() || (this.running() && this.following()));
  readonly progress = computed(() => {
    const run = this.run();
    return run && this.running() ? runProgress(run) : null;
  });

  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription: Subscription | undefined;
  private followSubscription: Subscription | undefined;
  /**
   * Bumped by every `load`: an answer to a start made before it belongs to a question the screen
   * no longer asks — another day, say — and is dropped.
   */
  private generation = 0;

  constructor(
    private readonly backend: {
      read: () => Observable<State>;
      start: () => Observable<TableRun>;
    },
  ) {}

  /** Reads the latest state from scratch, dropping whatever was read or followed before. */
  load(): void {
    this.generation += 1;
    this.loadSubscription?.unsubscribe();
    this.stopFollowing();
    this.state.set(null);
    this.loadFailed.set(false);
    this.followFailed.set(false);
    this.loadSubscription = this.backend
      .read()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.state.set(state);
          if (state.run?.status === 'running') {
            this.follow();
          }
        },
        error: () => this.loadFailed.set(true),
      });
  }

  /** Starts a run — or joins the one under way, which is what the backend answers with — and follows it. */
  start(): void {
    const generation = this.generation;
    this.starting.set(true);
    this.backend
      .start()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.starting.set(false);
          if (generation !== this.generation) {
            return;
          }
          this.loadFailed.set(false);
          // The last result stays on screen while the new run reads.
          this.state.update((state) => ({ ...(state as State), run }));
          this.follow();
        },
        error: () => this.starting.set(false),
      });
  }

  private follow(): void {
    this.stopFollowing();
    this.following.set(true);
    this.followFailed.set(false);
    this.followSubscription = timer(TABLE_RUN_POLL_MS, TABLE_RUN_POLL_MS)
      .pipe(
        // A slow answer is waited for rather than cancelled by the next tick.
        exhaustMap(() => this.backend.read()),
        takeWhile((state) => state.run?.status === 'running', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => this.state.set(state),
        // One toast, not one every two seconds: polling stops, and a press picks the run up again.
        error: () => {
          this.following.set(false);
          this.followFailed.set(true);
        },
        complete: () => this.following.set(false),
      });
  }

  private stopFollowing(): void {
    this.followSubscription?.unsubscribe();
    this.following.set(false);
  }
}
