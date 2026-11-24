/**
 * Biến merge mẫu Bản giải trình tiếp thu, hoàn thiện hồ sơ sau đánh giá (BM-05.07).
 * Khớp file BM-05.07_Ban_giai_trinh_tiep_thu_co_bien.docx — dùng {{ten_bien}}.
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const BAN_GIAI_TRINH_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  {
    key: 'ngay_lap',
    label: 'Ngày lập (vd: ngày 22 tháng 11 năm 2026)',
    group: 'Văn bản',
  },
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  { key: 'ma_so', label: 'Mã số nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  { key: 'chu_nhiem', label: 'Chủ nhiệm nhiệm vụ', group: 'Thông tin nhiệm vụ' },
  {
    key: 'ngay_danh_gia',
    label: 'Ngày đánh giá',
    group: 'Thông tin nhiệm vụ',
  },
  {
    key: 'ten_hoi_dong',
    label: 'Hội đồng / Tổ chuyên gia / chuyên gia',
    group: 'Thông tin nhiệm vụ',
  },
  {
    key: 'bang_noi_dung',
    label: 'Bảng nội dung tiếp thu, hoàn thiện (cả bảng)',
    group: 'Nội dung',
  },
]
