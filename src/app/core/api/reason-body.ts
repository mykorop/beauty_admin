/**
 * The reason of a body whose reason is optional: it travels only when there is one — never as an
 * empty string. Every such body is built with this, so no two of them can word it differently. (A
 * `DELETE` whose reason is optional sends no body at all without one, not an empty one.)
 */
export const withReason = (reason: string | undefined) => (reason ? { reason } : {});
