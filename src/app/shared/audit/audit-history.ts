import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Subject, switchMap } from 'rxjs';
import { AuditClient, type AuditEntry, type AuditPage, type AuditTargetType } from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatVenueDateTime } from '../venue-date';
import { AuditEntryDetails } from './audit-entry-details';

/**
 * «Історія»: the Журнал дій rows about one target, newest first. Read again every time the tab
 * opens, so an edit saved a moment ago on another tab is already here.
 *
 * Shared by the card of a Салон and the card of a Незалежний майстер — the two read the same log
 * and must not word it differently. The card that hosts it says whose rows to ask for and on whose
 * clock to date them.
 */
@Component({
  selector: 'app-audit-history',
  imports: [AuditEntryDetails, ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  template: `
    @if (entries(); as entries) {
      <div class="flex max-w-4xl flex-col gap-3">
        @for (entry of entries; track entry.auditId) {
          <article class="audit-history-card rounded-lg border border-divider bg-panel p-4 text-sm" data-testid="history-entry">
            <header class="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 class="font-semibold">{{ actionLabel(entry.action) }}</h2>
              <span class="text-muted">{{ venueDate(entry.createdAt) }}</span>
              <span class="text-muted">{{ entry.adminEmail || entry.adminId }}</span>
            </header>
            <app-audit-entry-details [entry]="entry" />
          </article>
        } @empty {
          <p class="content-state text-muted" data-testid="history-empty">{{ emptyKey() | t }}</p>
        }
        @if (nextCursor()) {
          <div>
            <button
              pButton
              type="button"
              severity="secondary"
              size="small"
              data-testid="history-more"
              [label]="'history.more' | t"
              [loading]="loading()"
              (click)="more.next()"
            ></button>
          </div>
        }
      </div>
    } @else if (failed()) {
      <p class="content-state text-danger" role="alert" data-testid="history-failed">{{ 'card.failed' | t }}</p>
    } @else {
      <p class="content-state text-muted" role="status" data-testid="history-loading">{{ 'common.loading' | t }}</p>
    }
  `,
})
export class AuditHistory implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly client = inject(AuditClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly targetType = input.required<AuditTargetType>();
  readonly targetId = input.required<string>();
  /** The profile's own zone: every moment of a card is dated on it, never on the browser's. */
  readonly timezone = input.required<string>();
  /** What "nothing happened here yet" says — a Салон and a Майстер word it differently. */
  readonly emptyKey = input.required<TranslationKey>();

  protected readonly entries = signal<AuditEntry[] | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly more = new Subject<void>();

  /** Not the constructor: a required input has no value until Angular has set it. */
  ngOnInit(): void {
    const loadPage = (cursor?: string) => {
      this.loading.set(true);
      return this.client.forTarget(this.targetType(), this.targetId(), cursor);
    };
    const appendPage = {
      next: ({ items, nextCursor }: AuditPage) => {
        this.entries.update((shown) => [...(shown ?? []), ...items]);
        this.nextCursor.set(nextCursor);
        this.loading.set(false);
      },
      // The interceptor has already worded the refusal as a toast.
      error: () => {
        this.failed.set(this.entries() === null);
        this.loading.set(false);
      },
    };
    loadPage().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(appendPage);
    this.more
      .pipe(
        switchMap(() => loadPage(this.nextCursor() ?? undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(appendPage);
  }

  protected venueDate(iso: string): string {
    return formatVenueDateTime(iso, this.i18n.locale(), this.timezone());
  }

  protected actionLabel(action: string): string {
    return this.i18n.optional(`audit.action.${action}`) ?? action;
  }
}
