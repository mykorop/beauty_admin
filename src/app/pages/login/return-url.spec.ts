import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps an in-app address, query string included', () => {
    expect(safeReturnUrl('/salons?city=Chisinau&page=2')).toBe('/salons?city=Chisinau&page=2');
  });

  it('falls back to home when there is nothing to return to', () => {
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl('')).toBe('/');
  });

  it('refuses an address that leaves the app', () => {
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('/\\evil.example')).toBe('/');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/');
  });

  it('does not return to the login screen', () => {
    expect(safeReturnUrl('/login?reason=notAdmin')).toBe('/');
    expect(safeReturnUrl('/login')).toBe('/');
    expect(safeReturnUrl('/login-history')).toBe('/login-history');
  });
});
