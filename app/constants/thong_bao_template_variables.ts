/**
 * Biến merge mẫu thông báo tuyển chọn đề tài.
 * Khớp file Template_Thong_bao_tuyen_chon_de_tai_UED.docx — dùng {{ten_bien}}.
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const THONG_BAO_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  { key: 'so', label: 'Số thông báo', group: 'Văn bản' },
  { key: 'ky_hieu', label: 'Ký hiệu thông báo', group: 'Văn bản' },
  { key: 'dd', label: 'Ngày hiện tại', group: 'Văn bản' },
  { key: 'mm', label: 'Tháng hiện tại', group: 'Văn bản' },
  { key: 'year', label: 'Năm hiện tại', group: 'Văn bản' },
  { key: 'yyyy', label: 'Năm hiện tại (phụ lục)', group: 'Văn bản' },
  { key: 'tieu_de', label: 'Tiêu đề thông báo', group: 'Nội dung' },
  { key: 'noi_dung_thong_bao', label: 'Nội dung thông báo (lấy từ nội dung hướng dẫn)', group: 'Nội dung' },
  { key: 'tham_quyen_ky', label: 'Thẩm quyền ký', group: 'Văn bản' },
  { key: 'ho_ten_nguoi_ky', label: 'Họ tên người ký', group: 'Văn bản' },
  { key: 'noi_nhan', label: 'Nơi nhận (mỗi dòng một mục)', group: 'Văn bản' },
  { key: 'nam_thuc_hien', label: 'Năm thực hiện', group: 'Nội dung' },
  { key: 'danh_sach_nhiem_vu', label: 'Bảng danh mục nhiệm vụ (gồm tiêu đề cột và các hàng)', group: 'Danh mục' },
]
