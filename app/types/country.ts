export const COUNTRY_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type CountryStatus = (typeof COUNTRY_STATUSES)[number]
