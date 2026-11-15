/**
 * Danh mục biến merge hợp đồng BM.06 / BM-02.14.
 * Khớp file BM-02.14_Hop_dong_co_bien.docx (+ giữ alias cũ để tương thích).
 */
export type Bm06VariableDef = {
  key: string
  label: string
  group: string
}

/** Biến chính theo mẫu BM-02.14 */
export const BM06_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  // Ký kết / số liệu HĐ
  { key: 'so_hop_dong', label: 'Số hợp đồng', group: 'Ký kết' },
  { key: 'ngay_ky', label: 'Ngày ký', group: 'Ký kết' },
  { key: 'so_ban', label: 'Tổng số bản hợp đồng', group: 'Ký kết' },
  { key: 'so_ban_ben_a', label: 'Số bản Bên A giữ', group: 'Ký kết' },
  { key: 'so_ban_ben_b', label: 'Số bản Bên B giữ', group: 'Ký kết' },

  // Nhiệm vụ
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Nhiệm vụ' },
  { key: 'ma_so_nhiem_vu', label: 'Mã số nhiệm vụ', group: 'Nhiệm vụ' },
  { key: 'muc_tieu', label: 'Mục tiêu', group: 'Nhiệm vụ' },
  { key: 'noi_dung_thuc_hien', label: 'Nội dung thực hiện', group: 'Nhiệm vụ' },
  { key: 'san_pham_yeu_cau', label: 'Sản phẩm yêu cầu', group: 'Nhiệm vụ' },
  { key: 'bang_tien_do', label: 'Bảng tiến độ', group: 'Nhiệm vụ' },
  { key: 'so_thang', label: 'Số tháng thực hiện', group: 'Nhiệm vụ' },
  { key: 'ngay_bat_dau', label: 'Ngày bắt đầu', group: 'Nhiệm vụ' },
  { key: 'ngay_ket_thuc', label: 'Ngày kết thúc', group: 'Nhiệm vụ' },
  { key: 'phuong_thuc_lua_chon', label: 'Phương thức lựa chọn', group: 'Nhiệm vụ' },
  { key: 'co_quan_phe_duyet', label: 'Cơ quan phê duyệt', group: 'Nhiệm vụ' },
  { key: 'so_qd_phe_duyet', label: 'Số QĐ phê duyệt', group: 'Nhiệm vụ' },
  { key: 'ngay_qd_phe_duyet', label: 'Ngày QĐ phê duyệt', group: 'Nhiệm vụ' },

  // Chủ nhiệm
  { key: 'chu_nhiem', label: 'Chủ nhiệm nhiệm vụ', group: 'Chủ nhiệm' },
  { key: 'chuc_vu_chu_nhiem', label: 'Chức vụ chủ nhiệm', group: 'Chủ nhiệm' },
  { key: 'don_vi_chu_nhiem', label: 'Đơn vị chủ nhiệm', group: 'Chủ nhiệm' },
  { key: 'dien_thoai_chu_nhiem', label: 'Điện thoại chủ nhiệm', group: 'Chủ nhiệm' },
  { key: 'email_chu_nhiem', label: 'Email chủ nhiệm', group: 'Chủ nhiệm' },

  // Bên A (từ profile trường)
  { key: 'ten_ben_a', label: 'Tên Bên A / Tên trường', group: 'Bên A' },
  { key: 'he_thong_dai_hoc', label: 'Hệ thống đại học vùng', group: 'Bên A' },
  { key: 'dai_dien_ben_a', label: 'Đại diện Bên A', group: 'Bên A' },
  { key: 'chuc_vu_ben_a', label: 'Chức vụ Bên A', group: 'Bên A' },
  { key: 'dia_chi_ben_a', label: 'Địa chỉ Bên A', group: 'Bên A' },
  { key: 'dien_thoai_ben_a', label: 'Điện thoại Bên A', group: 'Bên A' },
  { key: 'email_ben_a', label: 'Email Bên A', group: 'Bên A' },
  { key: 'tai_khoan_ben_a', label: 'Tài khoản Bên A', group: 'Bên A' },
  { key: 'ngan_hang_ben_a', label: 'Ngân hàng Bên A', group: 'Bên A' },
  { key: 'ma_so_thue_ben_a', label: 'Mã số thuế Bên A', group: 'Bên A' },

  // Bên B
  { key: 'to_chuc_ben_b', label: 'Tổ chức Bên B', group: 'Bên B' },
  { key: 'dai_dien_ben_b', label: 'Đại diện Bên B', group: 'Bên B' },
  { key: 'chuc_vu_ben_b', label: 'Chức vụ Bên B', group: 'Bên B' },
  { key: 'dia_chi_ben_b', label: 'Địa chỉ Bên B', group: 'Bên B' },
  { key: 'dien_thoai_ben_b', label: 'Điện thoại Bên B', group: 'Bên B' },
  { key: 'email_ben_b', label: 'Email Bên B', group: 'Bên B' },
  { key: 'so_tai_khoan_ben_b', label: 'Số tài khoản Bên B', group: 'Bên B' },
  { key: 'ngan_hang_ben_b', label: 'Ngân hàng Bên B', group: 'Bên B' },

  // Kinh phí
  { key: 'tong_kinh_phi', label: 'Tổng kinh phí', group: 'Kinh phí' },
  { key: 'kinh_phi_bang_chu', label: 'Tổng kinh phí bằng chữ', group: 'Kinh phí' },
  { key: 'bang_nguon_kinh_phi', label: 'Bảng nguồn kinh phí', group: 'Kinh phí' },

  // Alias / tương thích mẫu cũ
  { key: 'dia_diem_ky', label: 'Địa điểm ký', group: 'Ký kết (alias)' },
  { key: 'thang_ky', label: 'Tháng ký', group: 'Ký kết (alias)' },
  { key: 'nam_ky', label: 'Năm ký', group: 'Ký kết (alias)' },
  { key: 'ngay_hieu_luc', label: 'Ngày hiệu lực', group: 'Ký kết (alias)' },
  { key: 'so_ban_hop_dong', label: 'Số bản hợp đồng (alias)', group: 'Ký kết (alias)' },
  { key: 'so_ban_moi_ben', label: 'Số bản mỗi bên (alias)', group: 'Ký kết (alias)' },
  { key: 'loai_nhiem_vu', label: 'Loại nhiệm vụ', group: 'Nhiệm vụ (alias)' },
  { key: 'can_cu_phe_duyet_giao_nhiem_vu', label: 'Căn cứ phê duyệt giao nhiệm vụ', group: 'Nhiệm vụ (alias)' },
  { key: 'so_thang_thuc_hien', label: 'Số tháng thực hiện (alias)', group: 'Nhiệm vụ (alias)' },
  { key: 'thang_bat_dau', label: 'Tháng bắt đầu', group: 'Nhiệm vụ (alias)' },
  { key: 'nam_bat_dau', label: 'Năm bắt đầu', group: 'Nhiệm vụ (alias)' },
  { key: 'thang_ket_thuc', label: 'Tháng kết thúc', group: 'Nhiệm vụ (alias)' },
  { key: 'nam_ket_thuc', label: 'Năm kết thúc', group: 'Nhiệm vụ (alias)' },
  { key: 'chuc_vu_dai_dien_ben_a', label: 'Chức vụ đại diện Bên A (alias)', group: 'Bên A (alias)' },
  { key: 'ten_ben_b', label: 'Tên Bên B (alias)', group: 'Bên B (alias)' },
  { key: 'chuc_vu_dai_dien_ben_b', label: 'Chức vụ đại diện Bên B (alias)', group: 'Bên B (alias)' },
  { key: 'tong_kinh_phi_bang_chu', label: 'Tổng KP bằng chữ (alias)', group: 'Kinh phí (alias)' },
  { key: 'hinh_thuc_khoan_chi', label: 'Hình thức khoán chi', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_nsnn', label: 'Kinh phí NSNN', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_nsnn_bang_chu', label: 'Kinh phí NSNN bằng chữ', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_khoan', label: 'Kinh phí khoán', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_khoan_bang_chu', label: 'Kinh phí khoán bằng chữ', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_khong_giao_khoan', label: 'Kinh phí không giao khoán', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_khong_giao_khoan_bang_chu', label: 'KP không giao khoán bằng chữ', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_nguon_khac', label: 'Kinh phí nguồn khác', group: 'Kinh phí (alias)' },
  { key: 'kinh_phi_nguon_khac_bang_chu', label: 'KP nguồn khác bằng chữ', group: 'Kinh phí (alias)' },
  {
    key: 'ty_le_boi_hoan_loi_khach_quan_khong_dat',
    label: 'Tỷ lệ bồi hoàn lỗi khách quan (không đạt)',
    group: 'Bồi hoàn',
  },
  {
    key: 'ty_le_boi_hoan_loi_chu_quan_khong_dat',
    label: 'Tỷ lệ bồi hoàn lỗi chủ quan (không đạt)',
    group: 'Bồi hoàn',
  },
  {
    key: 'ty_le_boi_hoan_loi_khach_quan_dinh_chi',
    label: 'Tỷ lệ bồi hoàn lỗi khách quan (đình chỉ)',
    group: 'Bồi hoàn',
  },
  {
    key: 'ty_le_boi_hoan_loi_chu_quan_dinh_chi',
    label: 'Tỷ lệ bồi hoàn lỗi chủ quan (đình chỉ)',
    group: 'Bồi hoàn',
  },
  {
    key: 'dieu_khoan_giai_quyet_tranh_chap',
    label: 'Điều khoản giải quyết tranh chấp',
    group: 'Khác',
  },
]

export const BM06_TEMPLATE_VARIABLE_KEYS = BM06_TEMPLATE_VARIABLES.map((v) => v.key)

/** Biến đổ mẫu BM.14 khi admin đã upload mẫu THANH_LY. */
export const BM14_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Thanh lý' },
  { key: 'ma_nhiem_vu', label: 'Mã nhiệm vụ', group: 'Thanh lý' },
  { key: 'xep_loai', label: 'Xếp loại', group: 'Thanh lý' },
  { key: 'kinh_phi_da_cap', label: 'Kinh phí đã cấp', group: 'Kinh phí' },
  { key: 'kinh_phi_quyet_toan', label: 'Kinh phí quyết toán', group: 'Kinh phí' },
  { key: 'ton', label: 'Số tồn', group: 'Kinh phí' },
  { key: 'xu_ly_ton', label: 'Cách xử lý tồn', group: 'Kinh phí' },
  { key: 'ngay_quyet_toan', label: 'Ngày quyết toán', group: 'Kinh phí' },
  { key: 'tai_san', label: 'Danh sách tài sản', group: 'Tài sản' },
]
