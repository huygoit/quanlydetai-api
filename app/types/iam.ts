/**
 * Trạng thái role và permission.
 */
export const ROLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export const PERMISSION_STATUSES = ['ACTIVE', 'INACTIVE'] as const

/** Regex permission code: module.action (chữ thường, số, dấu _) */
export const PERMISSION_CODE_REGEX = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/
