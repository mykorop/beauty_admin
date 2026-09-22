import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import type { Subscription } from 'rxjs';
import { StatsClient, type BasicStats } from '../../core/api/stats.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { formatBuiltAt } from '../../shared/built-at';
import { dashboardGroups } from './dashboard-tiles';

/**
 * «Базові показники» — the screen the Адміністратор платформи lands on after signing in: the size
 * of the platform in four groups of four figures, and every figure a way into the list behind it.
 *
 * The backend tallies them from the very listings the three tables are served from, so a figure and
 * the list it opens can never disagree, and «Оновити» refreshes both at once — being the landing
 * screen, this is also what pays for those listings now, before any table is opened. What the tiles
 * mean and where they lead is `dashboard-tiles.ts`, which has the spec.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [Button, NgTemplateOutlet, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly client = inject(StatsClient);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stats = signal<BasicStats | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly groups = computed(() => {
    const stats = this.stats();
    return stats ? dashboardGroups(stats) : [];
  });

  protected readonly builtAt = computed(() => formatBuiltAt(this.stats()?.builtAt, this.i18n.locale()));

  private loadSubscription: Subscription | undefined;

  constructor() {
    this.load(false);
  }

  protected refresh(): void {
    this.load(true);
  }

  private load(refresh: boolean): void {
    this.loading.set(true);
    this.failed.set(false);
    // A refresh outruns whatever load is still in flight; the older answer must not land after it.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.client
      .basic({ refresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.loading.set(false);
        },
        // The interceptor has already worded the refusal as a toast; figures already shown stay.
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
