import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import type { ActivityEntry } from '../../core/api/activity.client';
import { SENTRY_LINKS } from '../../core/monitoring/sentry-links';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { effectLinesOf } from './activity-effects';
import { failedFieldsOf } from './activity-error';
import { type PathId, pathIdsOf } from './activity-links';
import {
  activityClientAppLabel,
  activityClientPlatformLabel,
  activityPathIdLabel,
  activityTriggerLabel,
} from './activity-wording';

/**
 * What one Журнал активності entry tells beyond its row: the error it was answered with — the
 * fields that failed the check, when that was the reason — for an account's sign-up or a code
 * Cognito sent, what Cognito did it for and the domain of the address (never the address), what the
 * app sent (the body, redacted by the backend, marked when it was cut at 4 KB), the ids of the
 * request's address, each leading to its screen where the panel has one, the app, version and
 * platform the request came from — to tell an old build's failure from a new one's — what the
 * request caused (each push, SMS and email it tried, whom it went to and whether it did, and the
 * Журнал дій row it wrote, leading to the «Історія» where its old and new values are), the
 * `requestId` a developer finds the request's CloudWatch lines by, with a button to copy it, and —
 * where the build names a Sentry organisation — the request's trace and its failure's event there.
 * Shared, like `AuditEntryDetails`, so the «Активність» tab of a card words an entry as the screen
 * does.
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
      @if (entry().triggerSource; as triggerSource) {
        <dt class="text-muted">{{ 'activityLog.field.trigger' | t }}</dt>
        <dd data-testid="activity-trigger-source">
          {{ triggerLabel(triggerSource) }}
          <span class="ml-2 font-mono text-muted">{{ triggerSource }}</span>
        </dd>
      }
      @if (entry().emailDomain; as emailDomain) {
        <dt class="text-muted">{{ 'activityLog.field.emailDomain' | t }}</dt>
        <dd class="font-mono" data-testid="activity-email-domain">{{ emailDomain }}</dd>
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
      @if (client(); as client) {
        <dt class="text-muted">{{ 'activityLog.field.client' | t }}</dt>
        <dd data-testid="activity-client">
          <span data-testid="activity-client-app">{{ client.app }}</span>
          <span class="ml-2 font-mono" data-testid="activity-client-version">{{ client.version }}</span>
          <span class="text-muted"> · </span>
          <span data-testid="activity-client-platform">{{ client.platform }}</span>
        </dd>
      }
      @if (effects(); as effects) {
        <dt class="text-muted">{{ 'activityLog.field.effects' | t }}</dt>
        <dd>
          <ul class="flex flex-col gap-1" data-testid="activity-effects">
            @for (line of effects; track $index) {
              <li class="flex flex-wrap items-center gap-2" data-testid="activity-effect">
                <span class="font-medium" data-testid="activity-effect-kind">{{ line.channel }}</span>
                @if (line.kind === 'delivery') {
                  <span data-testid="activity-effect-recipient">
                    @if (line.recipient; as recipient) {
                      @if (recipient.role) {
                        <span class="text-muted">{{ recipient.role }}</span>
                      }
                      @if (recipient.link; as link) {
                        <a class="ml-1 font-mono hover:underline" [routerLink]="link">{{ recipient.id }}</a>
                      } @else {
                        <span class="ml-1 font-mono">{{ recipient.id }}</span>
                      }
                    } @else {
                      <span class="text-muted">{{ 'activityLog.effect.noAccount' | t }}</span>
                    }
                  </span>
                  <p-tag data-testid="activity-effect-result" [severity]="line.severity" [value]="line.result" />
                  @if (line.code; as code) {
                    <span class="font-mono text-muted" data-testid="activity-effect-code">{{ code }}</span>
                  }
                } @else if (line.kind === 'audit') {
                  <span>{{ line.action }}</span>
                  <span class="text-muted">{{ line.target }}</span>
                  <span class="font-mono">{{ line.targetId }}</span>
                  <a
                    class="hover:underline"
                    data-testid="activity-effect-history"
                    [routerLink]="line.link.path"
                    [queryParams]="line.link.queryParams"
                    >{{ line.linkLabel }}</a
                  >
                }
              </li>
            }
          </ul>
          @if (entry().effectsOmitted; as omitted) {
            <p class="mt-1 text-muted" data-testid="activity-effects-omitted">
              {{ 'activityLog.effectsOmitted' | t: { count: omitted } }}
            </p>
          }
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
      @if (sentry(); as sentry) {
        <dt class="text-muted">{{ 'activityLog.field.sentry' | t }}</dt>
        <dd class="flex flex-wrap items-center gap-3" data-testid="activity-sentry">
          @if (sentry.trace; as href) {
            <a
              class="hover:underline"
              data-testid="activity-sentry-trace"
              target="_blank"
              rel="noopener noreferrer"
              [href]="href"
              >{{ 'activityLog.sentryTrace' | t
              }}<i class="pi pi-external-link ml-1 text-xs" aria-hidden="true"></i
            ></a>
          }
          @if (sentry.event; as href) {
            <a
              class="hover:underline"
              data-testid="activity-sentry-event"
              target="_blank"
              rel="noopener noreferrer"
              [href]="href"
              >{{ 'activityLog.sentryEvent' | t
              }}<i class="pi pi-external-link ml-1 text-xs" aria-hidden="true"></i
            ></a>
          }
        </dd>
      }
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

  /** What Cognito invoked its trigger for, worded beside its own name for it. */
  protected triggerLabel(triggerSource: string): string {
    return activityTriggerLabel(this.i18n, triggerSource);
  }

  /**
   * The app the request came from, worded, with its version; `null` when it named none — and for an
   * entry from before apps named themselves, or from an `admin-api` that does not serve `client` yet.
   */
  protected readonly client = computed(() => {
    const client = this.entry().client ?? null;
    return client === null
      ? null
      : {
          app: activityClientAppLabel(this.i18n, client.app),
          version: client.version,
          platform: activityClientPlatformLabel(this.i18n, client.platform),
        };
  });

  /**
   * What the request caused, one line an effect in the order it happened; `null` for a request that
   * caused nothing — and for an entry from before effects were kept.
   */
  protected readonly effects = computed(() => {
    const lines = effectLinesOf(this.i18n, this.entry());
    return lines.length > 0 ? lines : null;
  });

  /** Whatever else the error carried, as it came. */
  protected readonly otherDetails = computed(() => {
    const details = this.entry().error?.details;
    return details === undefined || details === null ? null : JSON.stringify(details, null, 2);
  });

  /**
   * Where the entry leads into Sentry: the issues of its trace, where its app sent one, and the
   * event its failure was reported as, where the backend reported one. `null` with neither — and in
   * a build that names no Sentry organisation.
   */
  protected readonly sentry = computed(() => {
    const { traceId, sentryEventId } = this.entry();
    if (!SENTRY_LINKS || (!traceId && !sentryEventId)) {
      return null;
    }
    return {
      trace: traceId ? SENTRY_LINKS.trace(traceId) : null,
      event: sentryEventId ? SENTRY_LINKS.event(sentryEventId) : null,
    };
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
