import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { type TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { map, type Subscription } from 'rxjs';
import { SALON_STATUS_SEVERITY, type SalonList, SalonsClient, type SalonStatus } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import {
  applyTableState,
  cityOptionsOf,
  PAGE_SIZES,
  parseTableState,
  SALON_SORT_FIELDS,
  SALON_STATUSES,
  type SalonsTableState,
  toQueryParams,
} from './salons-table-state';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Every Салон on the platform. The backend hands over the whole list; searching, filtering,
 * sorting and paging happen here, and the address — not the component — owns that state, so a
 * copied link reopens the same view.
 */
@Component({
  selector: 'app-salons-page',
  imports: [Button, FormsModule, IconField, InputIcon, InputText, RouterLink, Select, TableModule, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salons.page.html',
})
export class SalonsPage {
  private readonly client = inject(SalonsClient);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizes = [...PAGE_SIZES];

  protected readonly state = toSignal(this.route.queryParamMap.pipe(map(parseTableState)), {
    initialValue: parseTableState(this.route.snapshot.queryParamMap),
  });

  private readonly list = signal<SalonList | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly view = computed(() => applyTableState(this.list()?.items ?? [], this.state(), this.i18n.locale()));
  protected readonly first = computed(() => (this.view().page - 1) * this.state().size);
  protected readonly sortOrder = computed(() => (this.state().dir === 'asc' ? 1 : -1));

  protected readonly builtAt = computed(() => {
    const builtAt = this.list()?.builtAt;
    return builtAt
      ? new Intl.DateTimeFormat(this.i18n.locale(), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(builtAt))
      : null;
  });

  protected readonly statusOptions = computed(() =>
    SALON_STATUSES.map((status) => ({
      value: status,
      label: this.i18n.t(`salons.status.${status}`),
    })),
  );

  protected readonly cityOptions = computed(() => {
    const options = cityOptionsOf(this.list()?.items ?? [], this.i18n.locale());
    // A city from the address stays selectable even when no salon of the current list is in it.
    const selected = this.state().city;
    return selected && !options.some((option) => option.key === selected)
      ? [...options, { key: selected, label: selected }]
      : options;
  });

  /** The search box's own text: the address follows it after a pause, not on every keystroke. */
  protected readonly searchText = signal(this.state().q);
  /** The `q` of the navigation this page started last, until the address echoes it back. */
  private ownSearch: string | null = null;
  private loadSubscription: Subscription | undefined;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The address changed. If this page did it, the box is already ahead of it — writing `q` back
    // would eat the characters typed since. Anything else (Back, a pasted link) owns the box, and
    // a push still pending from before would overwrite the address just navigated to.
    effect(() => {
      const q = this.state().q;
      if (q === this.ownSearch) {
        this.ownSearch = null;
        return;
      }
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
      untracked(() => this.searchText.set(q));
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.load(false);
  }

  // PrimeNG hands the row template an untyped `$implicit`; these two give the status its type back.
  protected statusSeverity(status: SalonStatus): 'success' | 'warn' | 'danger' {
    return SALON_STATUS_SEVERITY[status];
  }

  protected statusLabelKey(status: SalonStatus): TranslationKey {
    return `salons.status.${status}`;
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'medium' }).format(date);
  }

  protected formatRating(rating: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(rating);
  }

  protected refresh(): void {
    this.load(true);
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.patch({}, { replaceUrl: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onStatus(status: SalonStatus | null): void {
    this.patch({ status, page: 1 });
  }

  protected onCity(city: string | null): void {
    this.patch({ city, page: 1 });
  }

  /** PrimeNG reports a header click and a paginator click through the same event. */
  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const current = this.state();
    const size = event.rows ?? current.size;
    const sort = SALON_SORT_FIELDS.find((field) => field === event.sortField) ?? current.sort;
    const dir = event.sortOrder === 1 ? 'asc' : 'desc';
    const sortChanged = sort !== current.sort || dir !== current.dir;
    this.patch({
      sort,
      dir,
      size,
      page: sortChanged || size !== current.size ? 1 : Math.floor((event.first ?? 0) / size) + 1,
    });
  }

  protected openSalon(salonId: string, event: MouseEvent): void {
    // The name is a real link (middle-click, "open in new tab"); let it handle its own clicks.
    if (!(event.target as HTMLElement).closest('a')) {
      void this.router.navigate(['/salons', salonId]);
    }
  }

  private patch(change: Partial<SalonsTableState>, options: { replaceUrl?: boolean } = {}): void {
    const current = this.state();
    // The shown page, not the requested one: "?page=9" of two pages must not survive a click on "next".
    // Every navigation carries the box's text, so a filter picked mid-typing does not drop it.
    const q = this.searchText();
    const next = { ...current, page: q === current.q ? this.view().page : 1, ...change, q };
    if ((Object.keys(next) as (keyof SalonsTableState)[]).every((key) => next[key] === current[key])) {
      return;
    }
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    this.ownSearch = next.q;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(next),
      replaceUrl: options.replaceUrl,
    });
  }

  private load(refresh: boolean): void {
    this.loading.set(true);
    this.failed.set(false);
    // A refresh outruns whatever load is still in flight; the older answer must not land after it.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.client
      .list({ refresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.loading.set(false);
        },
        // The interceptor has already worded the refusal as a toast; a stale list stays on screen.
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
