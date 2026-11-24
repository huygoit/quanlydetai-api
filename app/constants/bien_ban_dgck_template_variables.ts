/**
 * Biến merge mẫu Biên bản đánh giá KQCK (BM-05.06).
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const BIEN_BAN_DGCK_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Thông tin chung' },
  { key: 'ma_so', label: 'Mã số', group: 'Thông tin chung' },
  { key: 'chu_nhiem', label: 'Chủ nhiệm', group: 'Thông tin chung' },
  { key: 'to_chuc_chu_tri', label: 'Tổ chức / đơn vị chủ trì', group: 'Thông tin chung' },
  { key: 'so_qd_hd', label: 'Số QĐ thành lập HĐ', group: 'Thông tin chung' },
  {
    key: 'thoi_gian_dia_diem',
    label: 'Thời gian, địa điểm / hình thức họp',
    group: 'Thông tin chung',
  },
  { key: 'chu_tich', label: 'Chủ tịch / Tổ trưởng', group: 'Hội đồng' },
  { key: 'thu_ky', label: 'Thư ký', group: 'Hội đồng' },
  { key: 'tong_tv', label: 'Tổng số thành viên', group: 'Hội đồng' },
  { key: 'so_tham_du', label: 'Số tham dự hợp lệ', group: 'Hội đồng' },
  { key: 'nhan_xet_chung', label: 'Nhận xét chung (2.1)', group: 'Kết quả đánh giá' },
  { key: 'noi_dung_lam_ro', label: 'Nội dung cần làm rõ (2.2)', group: 'Kết quả đánh giá' },
  {
    key: 'giai_trinh_y_kien',
    label: 'Giải trình / ý kiến khác biệt (2.3)',
    group: 'Kết quả đánh giá',
  },
  { key: 'phieu_dat', label: 'Số phiếu Đạt', group: 'Biểu quyết' },
  { key: 'phieu_bo_sung', label: 'Số phiếu Cần bổ sung', group: 'Biểu quyết' },
  { key: 'phieu_khong_dat', label: 'Số phiếu Không đạt', group: 'Biểu quyết' },
  {
    key: 'so_quyen_bieu_quyet',
    label: 'Số thành viên có quyền biểu quyết',
    group: 'Biểu quyết',
  },
  { key: 'ket_luan', label: 'Kết luận xếp loại', group: 'Kết luận' },
  {
    key: 'noi_dung_hoan_thien',
    label: 'Nội dung cần hoàn thiện',
    group: 'Kết luận',
  },
  { key: 'thoi_han', label: 'Thời hạn hoàn thiện', group: 'Kết luận' },
  { key: 'nguoi_kiem_tra', label: 'Người kiểm tra, xác nhận', group: 'Kết luận' },
  { key: 'xu_ly_tiep_theo', label: 'Xử lý tiếp theo', group: 'Kết luận' },
  { key: 'kien_nghi_khac', label: 'Kiến nghị khác', group: 'Kết luận' },
]
