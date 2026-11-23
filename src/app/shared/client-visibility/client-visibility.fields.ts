import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ClientVisibility } from '../../core/api/client-visibility.model';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { cardDates } from '../profile-card/loaded-card';
import type { ClientVisibilityView } from './client-visibility';

/** The name of each Видимість, and what clients get of a profile in it. */
const VISIBILITY_COPY: Record<ClientVisibility, { label: TranslationKey; hint: TranslationKey }> = {
  public: { label: 'clientVisibility.value.public', hint: 'clientVisibility.hint.public' },
  link: { label: 'clientVisibility.value.link', hint: 'clientVisibility.hint.link' },
  hidden: { label: 'clientVisibility.value.hidden', hint: 'clientVisibility.hint.hidden' },
};

/**
 * Видимість and Приховані ціни as rows of a card's Профіль — read only, with no control at all: it
 * is the business's own choice, and the panel cannot change it. Its rows sit straight in the
 * card's field list, so the element itself takes no box of its own.
 *
 * What the answer does not say is a dash, never a guessed Публічний. A Майстер салону's rows are
 * his Салон's, and say so.
 */
@Component({
  selector: 'app-client-visibility-fields',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let shown = view();
    <dt class="text-muted">{{ 'clientVisibility.field.visibility' | t }}</dt>
    <dd data-testid="field-clientVisibility">
      @if (copy(); as copy) {
        <div data-testid="client-visibility">{{ copy.label | t }}</div>
        <div class="text-xs text-muted">{{ copy.hint | t }}</div>
      } @else {
        <div data-testid="client-visibility">—</div>
      }
    </dd>

    <dt class="text-muted">{{ 'clientVisibility.field.pricesHidden' | t }}</dt>
    <dd data-testid="field-pricesHidden">
      @switch (shown.pricesHidden) {
        @case (true) {
          {{ 'clientVisibility.pricesHidden.yes' | t }}
        }
        @case (false) {
          {{ 'clientVisibility.pricesHidden.no' | t }}
        }
        @default {
          —
        }
      }
    </dd>
    @if (shown.decidedBy === 'salon') {
      <dd class="field-hint text-xs text-muted" data-testid="client-visibility-decided-by-salon">
        {{ 'clientVisibility.decidedBySalon' | t }}
      </dd>
    }

    @if (lastChange(); as lastChange) {
      <dt class="text-muted">{{ 'clientVisibility.field.lastChange' | t }}</dt>
      <dd data-testid="field-clientVisibilityLastChange">{{ lastChange }}</dd>
    }
  `,
})
export class ClientVisibilityFields {
  private readonly dates = cardDates();

  readonly view = input.required<ClientVisibilityView>();

  protected readonly copy = computed(() => {
    const visibility = this.view().visibility;
    return visibility ? VISIBILITY_COPY[visibility] : null;
  });

  /** Who chose it and when, on the card's clock — whichever of the two the answer names. */
  protected readonly lastChange = computed(() => {
    const change = this.view().lastChange;
    if (!change) {
      return null;
    }
    const at = change.at ? this.dates.dateTime(change.at) : null;
    return [change.by, at].filter(Boolean).join(' · ');
  });
}
