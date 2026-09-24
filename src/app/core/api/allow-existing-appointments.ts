/**
 * The administrator's «save it anyway» over live Записи a change of the Робочий графік would leave
 * standing. It travels only on the repeat after the refusal that named them — never as `false` —
 * so the first request is always one the domain may refuse. Nothing is cancelled either way.
 */
export const withAllowedAppointments = (allowed: boolean | undefined) =>
  allowed ? { allowExistingAppointments: true } : {};
