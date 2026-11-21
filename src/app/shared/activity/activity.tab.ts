import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { cardScope } from '../profile-card/loaded-card';
import { activityFeed } from './activity-feed';
import { activityLogLink, type ActivitySubject, activitySubjectQuery } from './activity-subject';
import { ActivityTable } from './activity.table';

/**
 * «Активність» of a card: the Журнал активності of the profile it is open on, its filter fixed —
 * read whole, newest first, as the «Журнал активності» screen reads it, and worded the same
 * (`ActivityTable`). «Відкрити в Журналі активності» opens the screen under the same filter, to be
 * narrowed further.
 *
 * Shared by the cards of a Салон, a Незалежний майстер, a Майстер салону and a Клієнт; the card's
 * scope says whose entries to offer. A Незалежний майстер has two subjects — his own actions and
 * all that happened in his Місце — and the tab switches between them. A Салон's Власник acts across
 * his Мережа, so his entries are not the Салон's: the tab leads to them on the screen.
 */
@Component({
  selector: 'app-activity-tab',
  imports: [ActivityTable, Button, FormsModule, RouterLink, SelectButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      @if (subjectOptions(); as options) {
        <p-selectbutton
          data-testid="activity-tab-subject"
          size="small"
          optionLabel="label"
          optionValue="value"
          [options]="options"
          [allowEmpty]="false"
          [ngModel]="chosen()"
          (ngModelChange)="chosen.set($event)"
        />
      }
      <span class="flex-1"></span>
      @if (ownerLink; as owner) {
        <a
          class="text-sm font-medium hover:underline"
          data-testid="activity-tab-owner"
          [routerLink]="owner.path"
          [queryParams]="owner.queryParams"
          >{{ 'activityTab.ownerActivity' | t }}</a
        >
      }
      <a
        class="text-sm font-medium hover:underline"
        data-testid="activity-tab-open-log"
        [routerLink]="logLink().path"
        [queryParams]="logLink().queryParams"
        >{{ 'activityTab.openInLog' | t }}</a
      >
      <p-button
        data-testid="activity-refresh"
        severity="secondary"
        size="small"
        icon="pi pi-refresh"
        [label]="'list.refresh' | t"
        [loading]="log.loading()"
        (onClick)="log.reload()"
      />
    </div>
    <p class="mb-4 text-sm text-muted" data-testid="activity-tab-kept">
      {{ 'activityTab.kept' | t }}
    </p>
    <app-activity-table [feed]="log" />
  `,
})
export class ActivityTab {
  private readonly i18n = inject(I18nService);

  /** Whose entries: one profile's for as long as the tab stands, whatever changes on it meanwhile. */
  private readonly activity = cardScope()().activity;

  /** The subject shown — the first the card offers, until another is picked. */
  protected readonly chosen = signal<ActivitySubject>(this.activity.subjects[0]);
  protected readonly log = activityFeed(() => activitySubjectQuery(this.chosen()));

  /** The subjects to switch between, worded by their kind; `null` for a card that has one. */
  protected readonly subjectOptions = computed(() => {
    const { subjects } = this.activity;
    return subjects.length > 1
      ? subjects.map((value) => ({
          value,
          label: this.i18n.t(`activityTab.subject.${value.kind}`),
        }))
      : null;
  });

  protected readonly logLink = computed(() => activityLogLink(this.chosen()));
  /** The Власник as the one who acted, wherever in his Мережа — a Салон's alone. */
  protected readonly ownerLink =
    this.activity.owner === null
      ? null
      : activityLogLink({ kind: 'account', id: this.activity.owner });
}
