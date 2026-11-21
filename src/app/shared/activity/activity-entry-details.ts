import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import type { ActivityEntry } from '../../core/api/activity.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { failedFieldsOf } from './activity-error';
import { type PathId, pathIdsOf } from './activity-links';
import { activityPathIdLabel } from './activity-wording';

/**
 * What one Журнал активності entry tells beyond its row: the error it was answered with — the
 * fields that failed the check, when that was the reason — what the app sent (the body, redacted by
 * the backend, marked when it was cut at 4 KB), the ids of the request's address, each leading to
 * its screen where the panel has one, and the `requestId` a developer finds the request's
 * CloudWatch lines by, with a button to copy it. Shared, like `AuditEntryDetails`,
 * so the «Активність» tab of a card words an entry as the screen does.
 */
@Component({
  selector: 'app-activity-entry-details',
  imports: [ButtonDirective, RouterLink, Tag, TranslatePipe],
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
      @if (requestBody(); as body) {
        <dt class="text-muted">{{ 'activityLog.field.requestBody' | t }}</dt>
        <dd>
          @if (entry().requestBodyTruncated) {
            <p-tag
              class="mb-1"
              severity="warn"
              data-testid="activity-request-body-truncated"
              [value]="'activityLog.truncated' | t"
            />
          }
          <pre class="activity-request-body" data-testid="activity-request-body">{{ body }}</pre>
        </dd>
      }
      @if (pathIds(); as ids) {
        <dt class="text-muted">{{ 'activityLog.field.pathIds' | t }}</dt>
        <dd>
          <ul data-testid="activity-path-ids">
            @for (pathId of ids; track pathId.param) {
              <li data-testid="activity-path-id">
                <span class="text-muted" [class.font-mono]="!pathId.kind">{{ pathIdLabel(pathId) }}</span>
                @if (pathId.link; as link) {
                  <a class="ml-2 font-mono hover:underline" [routerLink]="link">{{ pathId.id }}</a>
                } @else {
                  <span class="ml-2 font-mono">{{ pathId.id }}</span>
                }
              </li>
            }
          </ul>
        </dd>
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

  /**
   * The body as sent, one field a line — or, cut at 4 KB, the text it was cut to, which is no JSON
   * to lay out any more. `null` without one, and for an entry from before bodies were kept.
   */
  protected readonly requestBody = computed(() => {
    const { requestBody, requestBodyTruncated } = this.entry();
    if (requestBody === null || requestBody === undefined) {
      return null;
    }
    return requestBodyTruncated ? String(requestBody) : JSON.stringify(requestBody, null, 2);
  });

  /** The ids of the request's address; `null` for an address without any. */
  protected readonly pathIds = computed(() => {
    const ids = pathIdsOf(this.entry());
    return ids.length > 0 ? ids : null;
  });

  protected pathIdLabel(pathId: PathId): string {
    return activityPathIdLabel(this.i18n, pathId);
  }

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
