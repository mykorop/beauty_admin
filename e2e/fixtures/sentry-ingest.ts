import type { BrowserContext, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.e2e-sentry';

/** Where the `e2e-sentry` build, the e2e one with a DSN, is served; see `playwright.config.ts`. */
export const SENTRY_E2E_PORT = 4301;
export const SENTRY_E2E_URL = `http://localhost:${SENTRY_E2E_PORT}`;

/** The part of a Sentry error event the specs read. */
export type SentryEvent = {
  environment?: string;
  user?: { id?: string };
  tags?: Record<string, string>;
  exception?: { values?: { type?: string; value?: string; mechanism?: { type?: string } }[] };
};

export type SentryIngest = {
  /** Error events the app sent, in the order they arrived. */
  readonly events: SentryEvent[];
  /**
   * Names of the transactions that arrived — `/login/`, `/dashboard/` — one per page or navigation,
   * sent when the next navigation starts or the page falls idle.
   */
  readonly transactions: string[];
};

type EnvelopeItem = { type?: string; payload: unknown };

/**
 * An envelope is newline-separated JSON: its own header, then a header and a payload per item.
 * The browser SDK sends no binary items, so every line parses.
 */
function itemsOf(envelope: string): EnvelopeItem[] {
  const [, ...lines] = envelope.split('\n').filter((line) => line.trim() !== '');
  const items: EnvelopeItem[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const header = JSON.parse(lines[index]) as { type?: string };
    items.push({ type: header.type, payload: JSON.parse(lines[index + 1]) });
  }
  return items;
}

/**
 * Stands in for Sentry's ingest of the `e2e-sentry` DSN and keeps what reaches it.
 *
 * In the dev build a transaction runs to tens of kilobytes — a span per served chunk — and a
 * browser lets only 64 KiB of `keepalive` requests be in flight at once, which the SDK's own guard
 * counts in characters rather than bytes. An event sent while a transaction is still on its way can
 * therefore fail before it leaves the page, so a spec that throws right after a navigation first
 * waits for that navigation's transaction to arrive.
 */
export async function installSentryIngest(context: BrowserContext): Promise<SentryIngest> {
  const ingest: SentryIngest = { events: [], transactions: [] };
  const { origin } = new URL(environment.sentry.dsn);

  await context.route(`${origin}/**`, async (route: Route): Promise<void> => {
    for (const item of itemsOf(route.request().postData() ?? '')) {
      if (item.type === 'event') {
        ingest.events.push(item.payload as SentryEvent);
      } else if (item.type === 'transaction') {
        ingest.transactions.push((item.payload as { transaction?: string }).transaction ?? '');
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{}',
    });
  });

  return ingest;
}

/** The exception an event is about: the last one, when an error carries the errors it wraps. */
function mainException(event: SentryEvent) {
  return event.exception?.values?.at(-1);
}

/** The exception of an event, as Sentry's issue title reads it: `ApiError: Internal error`. */
export function exceptionOf(event: SentryEvent): string {
  const exception = mainException(event);
  return `${exception?.type}: ${exception?.value}`;
}

/** What caught the exception, e.g. `auto.function.angular.error_handler` for Angular's handler. */
export function mechanismOf(event: SentryEvent): string | undefined {
  return mainException(event)?.mechanism?.type;
}
