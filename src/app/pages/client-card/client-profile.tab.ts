import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ClientCardStore } from './client-card.store';

/**
 * Профіль of the Клієнт — **read only, and there is no edit button anywhere on it**. The backend
 * has no endpoint behind one either: the panel looks a person up to answer a support request, and
 * changing someone else's personal data is not the platform's to do.
 *
 * Dates are the platform's clock, not the browser's: a Клієнт belongs to no venue.
 */
@Component({
  selector: 'app-client-profile-tab',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (client(); as client) {
      <dl
        class="grid max-w-4xl grid-cols-[14rem_1fr] gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm"
      >
        <dt class="text-slate-500">{{ 'client.field.name' | t }}</dt>
        <dd data-testid="field-name">{{ client.name || '—' }}</dd>

        <dt class="text-slate-500">{{ 'client.field.email' | t }}</dt>
        <dd data-testid="field-email">{{ client.email || '—' }}</dd>

        <dt class="text-slate-500">{{ 'client.field.phone' | t }}</dt>
        <dd data-testid="field-phone">{{ client.phone || '—' }}</dd>

        <dt class="text-slate-500">{{ 'client.field.language' | t }}</dt>
        <dd data-testid="field-language">{{ client.language || '—' }}</dd>

        <dt class="text-slate-500">{{ 'client.field.registeredAt' | t }}</dt>
        <dd data-testid="field-createdAt">{{ createdAt() }}</dd>

        @if (client.blockedAt) {
          <dt class="text-slate-500">{{ 'client.field.blockedAt' | t }}</dt>
          <dd data-testid="field-blockedAt">{{ blockedAt() }}</dd>

          <dt class="text-slate-500">{{ 'client.field.blockedReason' | t }}</dt>
          <dd data-testid="field-blockedReason">{{ client.blockedReason || '—' }}</dd>
        }
      </dl>
      <p class="mt-2 max-w-4xl text-xs text-slate-500" data-testid="client-readonly">
        {{ 'client.readonly' | t }}
      </p>
    }
  `,
})
export class ClientProfileTab {
  private readonly store = inject(ClientCardStore);
  protected readonly client = this.store.client.asReadonly();

  protected readonly createdAt = computed(() => this.store.platformDate(this.client()?.createdAt));
  protected readonly blockedAt = computed(() => this.store.platformDate(this.client()?.blockedAt));
}
