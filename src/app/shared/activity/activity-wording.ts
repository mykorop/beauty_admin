import type { I18nService } from '../../i18n/i18n.service';
import type { PathId } from './activity-links';

/** Where the dictionaries word an action: `activity.route.<routeKey>`. */
export const ACTIVITY_ROUTE_KEY_PREFIX = 'activity.route.';

/**
 * How the panel words an action of the Журнал активності. The dictionaries word the most frequent
 * routes; any other is shown as its `routeKey`, so no entry is left without a name.
 */
export function activityRouteLabel(i18n: I18nService, route: string): string {
  return i18n.optional(`${ACTIVITY_ROUTE_KEY_PREFIX}${route}`) ?? route;
}

/** The backend's `UserRole`, worded — or as it came, for a role the panel does not know yet. */
export function activityRoleLabel(i18n: I18nService, role: string): string {
  return i18n.optional(`activityLog.role.${role}`) ?? role;
}

/** The app a request came from, worded — or as it came, for an app the panel does not know yet. */
export function activityClientAppLabel(i18n: I18nService, app: string): string {
  return i18n.optional(`activityLog.clientApp.${app}`) ?? app;
}

/** The platform an app ran on, worded — or as it came, for one the panel does not know yet. */
export function activityClientPlatformLabel(i18n: I18nService, platform: string): string {
  return i18n.optional(`activityLog.clientPlatform.${platform}`) ?? platform;
}

/** An id of a request's address, worded by what it names — or, unworded, by its parameter. */
export function activityPathIdLabel(i18n: I18nService, pathId: PathId): string {
  return pathId.kind ? i18n.t(`activityLog.pathId.${pathId.kind}`) : pathId.param;
}
