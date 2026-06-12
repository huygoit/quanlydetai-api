/**
 * Các loại thông báo trong hệ thống.
 */
export type NotificationType =
  | 'PROFILE_SUBMITTED' // NCV gửi cập nhật hồ sơ
  | 'PROFILE_VERIFIED' // Phòng KH xác thực hồ sơ
  | 'PROFILE_NEED_INFO' // Yêu cầu bổ sung hồ sơ
  | 'PUBLICATION_SYNC' // Có công bố gợi ý mới
  | 'PUBLICATION_CORRECTION_REQUESTED' // Yêu cầu hiệu chỉnh kết quả NCKH
  | 'PUBLICATION_CORRECTED' // Người kê khai đã hiệu chỉnh — chờ kiểm tra/duyệt
  | 'IDEA_SUBMITTED' // NCV gửi ý tưởng mới (thông báo PHONG_KH)
  | 'IDEA_STATUS_CHANGED' // Ý tưởng thay đổi trạng thái
  | 'PROJECT_UPDATE' // Cập nhật đề tài
  | 'SYSTEM' // Thông báo hệ thống
