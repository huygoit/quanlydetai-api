/**
 * Các role trong hệ thống Quản lý Khoa học & Công nghệ
 */
export type UserRole =
  | 'NCV'           // Nhà khoa học / Giảng viên
  | 'CNDT'          // Chủ nhiệm đề tài
  | 'TRUONG_DON_VI' // Trưởng đơn vị
  | 'PHONG_KH'      // Phòng Khoa học
  | 'HOI_DONG'      // Hội đồng
  | 'LANH_DAO'      // Lãnh đạo
  | 'ADMIN'         // Admin

/** Danh sách role hợp lệ dùng cho validator (readonly để dùng với vine.enum) */
export const USER_ROLES = [
  'NCV',
  'CNDT',
  'TRUONG_DON_VI',
  'PHONG_KH',
  'HOI_DONG',
  'LANH_DAO',
  'ADMIN',
] as const
