/**
 * Trạng thái danh mục chức vụ
 */
export const STAFF_POSITION_STATUSES = ['ACTIVE', 'INACTIVE'] as const

/**
 * 2 loại chức vụ:
 * POSITION → position_title (chuỗi ID cách phẩy)
 * PARTY → party_position (chuỗi ID cách phẩy)
 */
export const STAFF_POSITION_KINDS = ['POSITION', 'PARTY'] as const

export type StaffPositionKind = (typeof STAFF_POSITION_KINDS)[number]
