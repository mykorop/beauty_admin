import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Select } from 'primeng/select';
import { catchError, map, of } from 'rxjs';
import { MastersClient } from '../../core/api/masters.client';
import { ReviewsClient, type ReviewsScope } from '../../core/api/reviews.client';
import { SalonsClient } from '../../core/api/salons.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { entityReviewsFeed } from '../../shared/reviews/reviews.feed';
import { ReviewsTable } from '../../shared/reviews/reviews.table';

/**
 * «Відгуки»: the стрічка модерації of the whole platform — read one profile at a time.
 *
 * The profile is a **filter the feed cannot be read without**, not a convenience. A review row's
 * three index keys are all spoken for (`MASTER#`, `SALON#`, `CLIENT#`), so there is no «every
 * review by time» partition behind a platform-wide pass, and answering one would mean a Scan that
 * ADR-0002 keeps off this path. Hence the two pickers above the table: they are fed by the same
 * cached lists the Салони and Незалежні майстри screens already load, so choosing a profile costs
 * nothing extra.
 *
 * Everything below the pickers — the filters, the paging, the приховання — is the shared table,
 * which is also what the «Відгуки» tab of each card shows.
 */
@Component({
  selector: 'app-reviews-page',
  imports: [FormsModule, ReviewsTable, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './reviews.page.html',
})
export class ReviewsPage {
  /**
   * This screen spans venues, so its days are the platform's — «21 вересня» means the day the
   * BookMe team lived. A card's own tab prints its venue's clock instead.
   */
  protected readonly platformTimeZone = PLATFORM_TIME_ZONE;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** The scope lives in the address, like every other filter of the panel, so a view can be linked to. */
  protected readonly scope = toSignal(
    this.route.queryParamMap.pipe(
      map((params): ReviewsScope => ({
        ...(params.get('salonId') ? { salonId: params.get('salonId') as string } : {}),
        ...(params.get('masterId') ? { masterId: params.get('masterId') as string } : {}),
      })),
    ),
    { initialValue: {} as ReviewsScope },
  );

  private readonly reviews = inject(ReviewsClient);

  /** `null` until a profile is chosen: the table would be refused without one. */
  protected readonly chosen = computed(() => {
    const scope = this.scope();
    return scope.salonId || scope.masterId ? entityReviewsFeed(this.reviews, scope) : null;
  });

  // A list that failed to load leaves the other picker — and a scope already in the address —
  // standing: it is a convenience over the feed, not the feed itself.
  private readonly salons = toSignal(
    inject(SalonsClient)
      .list()
      .pipe(
        map((list) => list.items),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );
  private readonly masters = toSignal(
    inject(MastersClient)
      .list()
      .pipe(
        map((list) => list.items),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );

  protected readonly salonOptions = computed(() =>
    this.salons().map((salon) => ({ value: salon.salonId, label: salon.name || salon.salonId })),
  );
  protected readonly masterOptions = computed(() =>
    this.masters().map((master) => ({
      value: master.masterId,
      label: master.name || master.masterId,
    })),
  );

  /**
   * One profile at a time: picking a Салон clears the Майстер and the other way round. The pair
   * together is the «Відгуки» tab of a Майстер салону, which is reached from his card — here it
   * would only read as «a Майстер who is somehow also a Салон».
   *
   * Changing the profile also drops the paging and the filters of the previous one, which is what
   * `queryParams` (rather than `merge`) does.
   */
  protected pick(scope: { salonId?: string | null; masterId?: string | null }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { salonId: scope.salonId || null, masterId: scope.masterId || null },
    });
  }
}
