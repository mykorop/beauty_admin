import { isLoginUrl } from '../../core/auth/session-expiry';

const HOME = '/';

/**
 * The address to open after signing in. `returnUrl` comes from the query string, so anybody can
 * craft it: only an in-app path is honoured — never `//host` or `/\host`, which a browser reads as
 * another site — and never the login screen itself.
 */
export function safeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl || !/^\/(?![/\\])/.test(returnUrl) || isLoginUrl(returnUrl)) {
    return HOME;
  }
  return returnUrl;
}
