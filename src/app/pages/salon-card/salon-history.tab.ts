import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Subject, switchMap } from 'rxjs';
import { AuditClient, type AuditEntry, type AuditPage } from '../../core/api/audit.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SalonCardStore } from './salon-card.store';

/**
 * «Історія»: the Журнал дій rows about this Салон, newest first, each with the old and new value of
 * every changed field — in full, PII included. Read again every time the tab opens, so an edit
 * saved a moment ago on another tab is already here.
 */
@Component({
  selector: 'app-salon-history-tab',
  imports: [ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries(); as entries) {
      <div class="flex max-w-4xl flex-col gap-3">
        @for (entry of entries; track entry.auditId) {
          <article class="rounded-lg border border-slate-200 bg-white p-4 text-sm" data-testid="history-entry">
            <header class="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 class="font-semibold">{{ actionLabel(entry.action) }}</h2>
              <span class="text-slate-500">{{ store.venueDate(entry.createdAt) }}</span>
              <span class="text-slate-500">{{ entry.adminEmail || entry.adminId }}</span>
            </header>
            @if (entry.changes.length > 0) {
              <table class="w-full table-fixed text-left">
                <thead class="text-xs text-slate-500">
                  <tr>
                    <th class="w-1/4 py-1 font-normal">{{ 'history.field' | t }}</th>
                    <th class="py-1 font-normal">{{ 'history.before' | t }}</th>
                    <th class="py-1 font-normal">{{ 'history.after' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (change of entry.changes; track change.field) {
                    <tr class="border-t border-slate-100 align-top" data-testid="history-change">
                      <td class="py-1 pr-3">{{ fieldLabel(change.field) }}</td>
                      <td class="py-1 pr-3 break-words whitespace-pre-line text-slate-500">
                        {{ display(change.before) }}
                      </td>
                      <td class="py-1 break-words whitespace-pre-line">{{ display(change.after) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (entry.reason) {
              <p class="mt-2 text-slate-600">{{ 'history.reason' | t: { reason: entry.reason } }}</p>
            }
          </article>
        } @empty {
          <p class="text-slate-500" data-testid="history-empty">{{ 'history.empty' | t }}</p>
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
      <p class="text-slate-600" data-testid="history-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonHistoryTab {
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(SalonCardStore);

  protected readonly entries = signal<AuditEntry[] | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly more = new Subject<void>();

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    const salonId = this.store.salon()?.salonId;
    if (!salonId) {
      return;
    }
    const client = inject(AuditClient);
    const loadPage = (cursor?: string) => {
      this.loading.set(true);
      return client.forTarget('salon', salonId, cursor);
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
    loadPage().pipe(takeUntilDestroyed()).subscribe(appendPage);
    this.more
      .pipe(
        switchMap(() => loadPage(this.nextCursor() ?? undefined)),
        takeUntilDestroyed(),
      )
      .subscribe(appendPage);
  }

  protected actionLabel(action: string): string {
    return this.i18n.optional(`audit.action.${action}`) ?? action;
  }

  /** A profile field is named as the Профіль tab names it; anything else keeps its raw path. */
  protected fieldLabel(field: string): string {
    return this.i18n.optional(`salon.field.${FIELD_LABEL_ALIASES[field] ?? field}`) ?? field;
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }
}

/** Row attributes whose label on the Профіль tab lives under another name. */
const FIELD_LABEL_ALIASES: Record<string, string> = {
  bufferMinutes: 'buffer',
  bookingForwardDays: 'bookingHorizon',
};
