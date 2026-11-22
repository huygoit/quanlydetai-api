/**
 * Biến merge mẫu Đơn đề nghị đánh giá kết quả nhiệm vụ (BM-05.01).
 * Khớp file BM-05.01_Don_de_nghi_danh_gia_ket_qua_co_bien.docx — dùng {{ten_bien}}.
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const DON_DE_NGHI_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  {
    key: 'ngay_lap',
    label: 'Ngày lập đơn (vd: ngày 22 tháng 11 năm 2026)',
    group: 'Văn bản',
  },
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  { key: 'ma_so', label: 'Mã số nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  { key: 'cap_quan_ly', label: 'Cấp quản lý', group: 'Thông tin nhiệm vụ' },
  {
    key: 'so_qd_hd',
    label: 'Số quyết định phê duyệt / hợp đồng',
    group: 'Thông tin nhiệm vụ',
  },
  {
    key: 'ngay_qd_hd',
    label: 'Ngày quyết định / hợp đồng',
    group: 'Thông tin nhiệm vụ',
  },
  { key: 'chu_nhiem', label: 'Chủ nhiệm nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  {
    key: 'to_chuc_chu_tri',
    label: 'Tổ chức / đơn vị chủ trì',
    group: 'Thông tin nhiệm vụ',
  },
  { key: 'thoi_gian_tu', label: 'Thời gian thực hiện — từ', group: 'Thông tin nhiệm vụ' },
  { key: 'thoi_gian_den', label: 'Thời gian thực hiện — đến', group: 'Thông tin nhiệm vụ' },
  { key: 'gia_han', label: 'Gia hạn (nếu có)', group: 'Thông tin nhiệm vụ' },
]
