import { computed, DestroyRef, Directive, effect, inject, type OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { TableLazyLoadEvent } from 'primeng/table';
import { map, type Observable, type Subscription } from 'rxjs';
import { I18nService } from '../../i18n/i18n.service';
import { formatBuiltAt } from '../built-at';
import {
  applyProfileTableState,
  cityOptionsOf,
  PAGE_SIZES,
  parseProfileTableState,
  PROFILE_STATUS_FILTERS,
  toProfileQueryParams,
  type ProfileRow,
  type ProfileStatusFilter,
  type ProfileTableState,
} from './profile-table-state';

/** One whole listing as `admin-api` hands it over, with the moment it was built from the table. */
export type ProfileList<Row> = { items: Row[]; builtAt: string };

const SEARCH_DEBOUNCE_MS = 250;

/** What a page is, as far as the shared table is concerned: its columns and its default view. */
export type ProfileTableConfig<Sort extends string> = {
  sortFields: readonly Sort[];
  defaults: ProfileTableState<Sort>;
  /**
   * Whether these profiles have a locality at all, and so whether the page draws the city filter.
   *
   * A page that draws no control for a filter must not be subject to it either: `?city=` on the
   * Клієнти table would otherwise match nothing, empty the list, and leave no way on screen to
   * clear it — a hand-typed or stale address turning into a table that looks simply broken.
   */
  city: boolean;
};

/**
 * Everything the Салони and the Незалежні майстри tables do identically: the whole list in one
 * response, the search box the address follows after a pause, the filters, the sorting, the paging
 * and the «Оновити» that makes the backend rebuild its cached list.
 *
 * A page extends this, says where its rows come from (`fetch`) and how a row is identified
 * (`idOf`), and keeps only its own columns. The address — not the component — owns the state, so a
 * copied link reopens the same view.
 *
 * `@Directive()` without a selector is what lets an abstract base hold `ngOnInit` and `inject`;
 * only the concrete pages below it are components.
 */
@Directive()
export abstract class ProfileTablePage<Row extends ProfileRow, Sort extends keyof Row & string>
  implements OnInit
{
  /** The whole list; `refresh` asks the backend to rebuild it rather than serve its cache. */
  protected abstract fetch(options: { refresh: boolean }): Observable<ProfileList<Row>>;
  protected abstract idOf(row: Row): string;

  /** Overridden by a page whose cell shows something other than the stored value. */
  protected sortValue(row: Row, field: Sort): unknown {
    return row[field];
  }

  protected readonly i18n = inject(I18nService);
  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSizes = [...PAGE_SIZES];

  private readonly list = signal<ProfileList<Row> | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly state = computed(() => this.addressState());
  protected readonly view = computed(() =>
    applyProfileTableState(this.list()?.items ?? [], this.state(), this.i18n.locale(), {
      idOf: (row) => this.idOf(row),
      sortValueOf: (row, field) => this.sortValue(row, field),
    }),
  );
  protected readonly first = computed(() => (this.view().page - 1) * this.state().size);
  protected readonly sortOrder = computed(() => (this.state().dir === 'asc' ? 1 : -1));

  protected readonly builtAt = computed(() => formatBuiltAt(this.list()?.builtAt, this.i18n.locale()));

  /**
   * `all` is an option and not only an address: a dashboard tile can put it there, and a filter the
   * screen cannot show — or undo — is a table that just looks broken.
   */
  protected readonly statusOptions = computed(() =>
    PROFILE_STATUS_FILTERS.map((status) => ({ value: status, label: this.i18n.t(`profile.status.${status}`) })),
  );

  protected readonly cityOptions = computed(() => {
    const options = cityOptionsOf(this.list()?.items ?? [], this.i18n.locale());
    // A city from the address stays selectable even when no profile of the current list is in it.
    const selected = this.state().city;
    return selected && !options.some((option) => option.key === selected)
      ? [...options, { key: selected, label: selected }]
      : options;
  });

  /** The search box's own text: the address follows it after a pause, not on every keystroke. */
  protected readonly searchText = signal('');
  /** The `q` of the navigation this page started last, until the address echoes it back. */
  private ownSearch: string | null = null;
  private readonly addressState: () => ProfileTableState<Sort>;
  private loadSubscription: Subscription | undefined;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly config: ProfileTableConfig<Sort>) {
    const parse = (params: { get(name: string): string | null }): ProfileTableState<Sort> => {
      const state = parseProfileTableState(params, config.sortFields, config.defaults);
      // An address is user input, and a page without the control cannot honour — or undo — this one.
      return config.city ? state : { ...state, city: null };
    };
    this.addressState = toSignal(this.route.queryParamMap.pipe(map(parse)), {
      initialValue: parse(this.route.snapshot.queryParamMap),
    });
    this.searchText.set(this.addressState().q);

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
  }

  /**
   * Not the constructor: the first load calls `fetch`, which lives on the subclass and reads
   * fields the subclass only initialises after `super()` has returned.
   */
  ngOnInit(): void {
    this.load(false);
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'medium' }).format(date);
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

  protected onStatus(status: ProfileStatusFilter | null): void {
    this.patch({ status, page: 1 });
  }

  protected onCity(city: string | null): void {
    this.patch({ city, page: 1 });
  }

  /** PrimeNG reports a header click and a paginator click through the same event. */
  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const current = this.state();
    const size = event.rows ?? current.size;
    const sort = this.config.sortFields.find((field) => field === event.sortField) ?? current.sort;
    const dir = event.sortOrder === 1 ? 'asc' : 'desc';
    const sortChanged = sort !== current.sort || dir !== current.dir;
    this.patch({
      sort,
      dir,
      size,
      page: sortChanged || size !== current.size ? 1 : Math.floor((event.first ?? 0) / size) + 1,
    });
  }

  private patch(change: Partial<ProfileTableState<Sort>>, options: { replaceUrl?: boolean } = {}): void {
    const current = this.state();
    // The shown page, not the requested one: "?page=9" of two pages must not survive a click on "next".
    // Every navigation carries the box's text, so a filter picked mid-typing does not drop it.
    const q = this.searchText();
    const next = { ...current, page: q === current.q ? this.view().page : 1, ...change, q };
    if ((Object.keys(next) as (keyof ProfileTableState<Sort>)[]).every((key) => next[key] === current[key])) {
      return;
    }
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    this.ownSearch = next.q;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toProfileQueryParams(next, this.config.defaults),
      replaceUrl: options.replaceUrl,
    });
  }

  private load(refresh: boolean): void {
    this.loading.set(true);
    this.failed.set(false);
    // A refresh outruns whatever load is still in flight; the older answer must not land after it.
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.fetch({ refresh })
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
