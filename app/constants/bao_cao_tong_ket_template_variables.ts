/**
 * Biến merge mẫu Báo cáo tổng kết kết quả thực hiện nhiệm vụ (BM-05.02).
 * Khớp file BM-05.02_Bao_cao_tong_ket_co_bien.docx — dùng {{ten_bien}}.
 * Thông tin chung: biến theo từng dòng. Bảng sản phẩm: một biến bang_san_pham.
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const BAO_CAO_TONG_KET_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  {
    key: 'ngay_lap',
    label: 'Ngày lập báo cáo (vd: ngày 22 tháng 11 năm 2026)',
    group: 'Văn bản',
  },
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: '1. Thông tin chung' },
  {
    key: 'ma_so_cap_quan_ly',
    label: 'Mã số, cấp quản lý',
    group: '1. Thông tin chung',
  },
  { key: 'chu_nhiem', label: 'Chủ nhiệm nhiệm vụ', group: '1. Thông tin chung' },
  {
    key: 'to_chuc_chu_tri',
    label: 'Tổ chức / đơn vị chủ trì',
    group: '1. Thông tin chung',
  },
  {
    key: 'so_qd_hd',
    label: 'Quyết định phê duyệt / Hợp đồng',
    group: '1. Thông tin chung',
  },
  {
    key: 'thoi_gian_thuc_hien',
    label: 'Thời gian thực hiện (gia hạn nếu có)',
    group: '1. Thông tin chung',
  },
  {
    key: 'tong_kinh_phi',
    label: 'Tổng kinh phí được phê duyệt',
    group: '1. Thông tin chung',
  },
  {
    key: 'don_vi_phoi_hop',
    label: 'Đơn vị phối hợp, đối tác (nếu có)',
    group: '1. Thông tin chung',
  },
  {
    key: 'tom_tat_ket_qua',
    label: '2. Tóm tắt kết quả',
    group: 'Nội dung',
  },
  {
    key: 'tong_quan_van_de',
    label: '3. Tổng quan vấn đề nghiên cứu',
    group: 'Nội dung',
  },
  {
    key: 'muc_tieu_doi_tuong_pham_vi',
    label: '4.1 Mục tiêu, đối tượng và phạm vi',
    group: 'Nội dung',
  },
  {
    key: 'noi_dung_nghien_cuu',
    label: '4.2 Nội dung nghiên cứu',
    group: 'Nội dung',
  },
  {
    key: 'phuong_phap_nghien_cuu',
    label: '4.3 Phương pháp nghiên cứu',
    group: 'Nội dung',
  },
  {
    key: 'ket_qua_nghien_cuu',
    label: '5. Kết quả nghiên cứu',
    group: 'Nội dung',
  },
  {
    key: 'bang_san_pham',
    label:
      '6.1 Các bảng sản phẩm như thuyết minh (công bố / ứng dụng / mẫu / SHTT / đào tạo — chỉ hiện bảng có dữ liệu)',
    group: '6. Sản phẩm',
  },
  {
    key: 'ghi_chu_san_pham',
    label: 'Ghi chú sản phẩm chưa hoàn thành / thay đổi',
    group: '6. Sản phẩm',
  },
  {
    key: 'hieu_qua_ung_dung',
    label: '6.2 Hiệu quả và khả năng ứng dụng',
    group: '6. Sản phẩm',
  },
  { key: 'ket_luan', label: '7.1 Kết luận', group: '7. Kết luận' },
  { key: 'kien_nghi', label: '7.2 Kiến nghị', group: '7. Kết luận' },
  {
    key: 'tai_lieu_tham_khao',
    label: '8.1 Tài liệu tham khảo',
    group: '8. Phụ lục',
  },
  {
    key: 'phu_luc_minh_chung',
    label: '8.2 Phụ lục và minh chứng',
    group: '8. Phụ lục',
  },
]
