import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import type { ActivityEntry } from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { failedFieldsOf } from './activity-error';

/**
 * What one Журнал активності entry tells beyond its row: the error it was answered with — the
 * fields that failed the check, when that was the reason — and the `requestId` a developer finds
 * the request's CloudWatch lines by, with a button to copy it. Shared, like `AuditEntryDetails`,
 * so the «Активність» tab of a card words an entry as the screen does.
 */
@Component({
  selector: 'app-activity-entry-details',
  imports: [ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'activity-entry-details' },
  template: `
    <dl class="activity-details">
      @if (entry().error; as error) {
        <dt class="text-muted">{{ 'activityLog.field.errorCode' | t }}</dt>
        <dd class="font-mono" data-testid="activity-error-code">{{ error.code }}</dd>
        <dt class="text-muted">{{ 'activityLog.field.errorMessage' | t }}</dt>
        <dd data-testid="activity-error-message">{{ error.message }}</dd>
        @if (failedFields(); as fields) {
          <dt class="text-muted">{{ 'activityLog.field.validation' | t }}</dt>
          <dd>
            <ul class="list-inside list-disc">
              @for (failed of fields; track failed.field) {
                <li data-testid="activity-validation-field">
                  <span class="font-mono">{{ failed.field }}</span>: {{ failed.messages }}
                </li>
              }
            </ul>
          </dd>
        } @else if (otherDetails(); as details) {
          <dt class="text-muted">{{ 'activityLog.field.errorDetails' | t }}</dt>
          <dd>
            <pre class="activity-error-details" data-testid="activity-error-details">{{ details }}</pre>
          </dd>
        }
      }
      <dt class="text-muted">{{ 'activityLog.field.requestId' | t }}</dt>
      <dd class="flex flex-wrap items-center gap-2">
        <span class="font-mono" data-testid="activity-request-id">{{ entry().requestId }}</span>
        <button
          pButton
          type="button"
          severity="secondary"
          size="small"
          [text]="true"
          icon="pi pi-copy"
          data-testid="activity-copy-request-id"
          [label]="'activityLog.copy' | t"
          (click)="copyRequestId()"
        ></button>
      </dd>
    </dl>
  `,
})
export class ActivityEntryDetails {
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  readonly entry = input.required<ActivityEntry>();

  /** The fields a `VALIDATION_ERROR` names, or `null` when the answer was something else. */
  protected readonly failedFields = computed(() => failedFieldsOf(this.entry().error));

  /** Whatever else the error carried, as it came. */
  protected readonly otherDetails = computed(() => {
    const details = this.entry().error?.details;
    return details === undefined || details === null ? null : JSON.stringify(details, null, 2);
  });

  protected async copyRequestId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.entry().requestId);
      this.messages.add({ severity: 'success', summary: this.i18n.t('activityLog.copied'), life: 4000 });
    } catch {
      // No clipboard — an insecure origin or a refused permission. The id stays on screen to select.
      this.messages.add({ severity: 'warn', summary: this.i18n.t('activityLog.copyFailed'), life: 8000 });
    }
  }
}
