import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService, LANGUAGE_STORAGE_KEY } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('starts in Ukrainian whatever the browser language is', () => {
    const i18n = TestBed.inject(I18nService);

    expect(i18n.language()).toBe('uk');
    expect(i18n.t('nav.salons')).toBe('Салони');
  });

  it('restores the language chosen earlier in this browser', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ro');

    expect(TestBed.inject(I18nService).language()).toBe('ro');
  });

  it('persists a switch and translates in the new language', () => {
    const i18n = TestBed.inject(I18nService);

    i18n.setLanguage('ru');

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
    expect(i18n.t('nav.salons')).toBe('Салоны');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('lists what the dictionaries word under a prefix, in their order, without the prefix', () => {
    const routes = TestBed.inject(I18nService).wordedUnder('activity.route.');

    expect(routes).toContain('PATCH /client/appointments/{appointmentId}/cancel');
    expect(routes.indexOf('POST /client/profile')).toBeLessThan(routes.indexOf('POST /salon/register'));
    expect(routes.every((route) => !route.startsWith('activity.'))).toBeTrue();
    expect(TestBed.inject(I18nService).wordedUnder('no.such.prefix.')).toEqual([]);
  });

  it('translates a known error code and shows an unknown one as it is', () => {
    const i18n = TestBed.inject(I18nService);

    expect(i18n.errorMessage('FORBIDDEN')).toBe('Недостатньо прав для цієї дії.');
    expect(i18n.errorMessage('SOME_NEW_DOMAIN_LAW')).toBe('SOME_NEW_DOMAIN_LAW');
  });
});
