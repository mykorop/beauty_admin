import { sentryLinks } from './sentry-links';

const ORG = 'https://bookme.sentry.io';

describe('sentryLinks', () => {
  it('links nowhere for a build without the organisation’s address', () => {
    expect(sentryLinks('')).toBeNull();
  });

  it('finds the issues of a trace in every project, over the 90 days the log keeps', () => {
    expect(sentryLinks(ORG)?.trace('4bf92f3577b34da6a3ce929d0e0e4736')).toBe(
      'https://bookme.sentry.io/issues/?project=-1&statsPeriod=90d&query=trace%3A4bf92f3577b34da6a3ce929d0e0e4736',
    );
  });

  it('finds an event by its bare id, which Sentry’s issue search opens', () => {
    expect(sentryLinks(ORG)?.event('d3b07384d113edec49eaa6238ad5ff00')).toBe(
      'https://bookme.sentry.io/issues/?project=-1&statsPeriod=90d&query=d3b07384d113edec49eaa6238ad5ff00',
    );
  });

  it('finds the errors of an account by its user.id', () => {
    expect(sentryLinks(ORG)?.errorsOf('5f1c8a2e-0b7d-4f43-9a55-1c2d3e4f5a6b')).toBe(
      'https://bookme.sentry.io/issues/?project=-1&statsPeriod=90d&query=user.id%3A5f1c8a2e-0b7d-4f43-9a55-1c2d3e4f5a6b',
    );
  });

  it('takes the address with a trailing slash, or as Sentry’s path names the organisation', () => {
    expect(sentryLinks('https://bookme.sentry.io/')?.errorsOf('c1')).toBe(
      'https://bookme.sentry.io/issues/?project=-1&statsPeriod=90d&query=user.id%3Ac1',
    );
    expect(sentryLinks('https://sentry.io/organizations/bookme')?.errorsOf('c1')).toBe(
      'https://sentry.io/organizations/bookme/issues/?project=-1&statsPeriod=90d&query=user.id%3Ac1',
    );
  });
});
