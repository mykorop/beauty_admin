import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivityEffect } from '../../core/api/activity.client';
import { I18nService, LANGUAGE_STORAGE_KEY } from '../../i18n/i18n.service';
import { effectLinesOf } from './activity-effects';

describe('effectLinesOf', () => {
  let i18n: I18nService;
  const AT = '2026-09-21T10:00:00.000Z';
  const linesOf = (...effects: ActivityEffect[]) => effectLinesOf(i18n, { effects, createdAt: AT });

  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    i18n = TestBed.inject(I18nService);
  });
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('words a push that went: its channel, the account told — its role, its card — and the result', () => {
    expect(linesOf({ kind: 'push', recipient: { id: 'o-1', role: 'salon' }, result: 'sent' })).toEqual([
      {
        kind: 'delivery',
        channel: 'Push',
        recipient: { id: 'o-1', role: 'Власник салону', link: ['/salons', 'o-1'] },
        result: 'Надіслано',
        severity: 'success',
        code: null,
      },
    ]);
  });

  it('tells a token FCM no longer knows from a delivery that failed, each with its code', () => {
    const [invalid, failed] = linesOf(
      { kind: 'push', recipient: { id: 'c-1', role: 'client' }, result: 'invalid-token', code: 'UNREGISTERED' },
      { kind: 'sms', recipient: null, result: 'failed', code: 'rate-limited' },
    );

    expect(invalid).toEqual(
      jasmine.objectContaining({ result: 'Недійсний токен', severity: 'warn', code: 'UNREGISTERED' }),
    );
    expect(failed).toEqual(
      jasmine.objectContaining({
        channel: 'SMS',
        recipient: null,
        result: 'Не надіслано',
        severity: 'danger',
        code: 'rate-limited',
      }),
    );
  });

  it('shows an account of a role its sender did not know without a card, and what the panel does not word as it came', () => {
    expect(
      linesOf({ kind: 'fax', recipient: { id: 'u-1', role: null }, result: 'queued' } as unknown as ActivityEffect),
    ).toEqual([
      {
        kind: 'delivery',
        channel: 'fax',
        recipient: { id: 'u-1', role: null, link: null },
        result: 'queued',
        severity: 'secondary',
        code: null,
      },
    ]);
  });

  it('words a Журнал дій row by its action and target, leading to the «Історія» of its card', () => {
    expect(
      linesOf({
        kind: 'audit',
        auditId: 'a-1',
        target: { type: 'salon', id: 's-1' },
        salonId: 's-1',
        action: 'salon.block',
      }),
    ).toEqual([
      {
        kind: 'audit',
        channel: 'Журнал дій',
        action: 'Блокування Салону',
        target: 'Салон',
        targetId: 's-1',
        link: { to: 'history', path: ['/salons', 's-1', 'history'], queryParams: null },
        linkLabel: 'Відкрити «Історію»',
      },
    ]);
  });

  it('leads a row about a card with no «Історія» to the Журнал дій, and says so', () => {
    const [line] = linesOf({
      kind: 'audit',
      auditId: 'a-2',
      target: { type: 'master', id: 'm-1' },
      salonId: 's-1',
      action: 'salon.master.update',
    });

    expect(line).toEqual(jasmine.objectContaining({ linkLabel: 'Відкрити в Журналі дій' }));
  });

  it('words nothing for an entry from before effects were kept', () => {
    expect(effectLinesOf(i18n, { createdAt: AT })).toEqual([]);
  });
});
