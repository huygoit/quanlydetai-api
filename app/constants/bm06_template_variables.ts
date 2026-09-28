/**
 * Danh mục biến merge BM.06 (khớp file BM06_Mau_hop_dong_co_bien.docx).
 * Dùng {{ten_bien}} trong DOCX.
 */
export type Bm06VariableDef = {
  key: string
  label: string
  group: string
}

export const BM06_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  { key: 'dia_diem_ky', label: 'Địa điểm ký', group: 'Ký kết' },
  { key: 'ngay_ky', label: 'Ngày ký', group: 'Ký kết' },
  { key: 'thang_ky', label: 'Tháng ký', group: 'Ký kết' },
  { key: 'nam_ky', label: 'Năm ký', group: 'Ký kết' },
  { key: 'ngay_hieu_luc', label: 'Ngày hiệu lực', group: 'Ký kết' },
  { key: 'so_hop_dong', label: 'Số hợp đồng', group: 'Ký kết' },
  { key: 'so_ban_hop_dong', label: 'Số bản hợp đồng', group: 'Ký kết' },
  { key: 'so_ban_moi_ben', label: 'Số bản mỗi bên giữ', group: 'Ký kết' },

  { key: 'loai_nhiem_vu', label: 'Loại nhiệm vụ', group: 'Nhiệm vụ' },
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: 'Nhiệm vụ' },
  { key: 'can_cu_phe_duyet_giao_nhiem_vu', label: 'Căn cứ phê duyệt giao nhiệm vụ', group: 'Nhiệm vụ' },
  { key: 'so_thang_thuc_hien', label: 'Số tháng thực hiện', group: 'Nhiệm vụ' },
  { key: 'thang_bat_dau', label: 'Tháng bắt đầu', group: 'Nhiệm vụ' },
  { key: 'nam_bat_dau', label: 'Năm bắt đầu', group: 'Nhiệm vụ' },
  { key: 'thang_ket_thuc', label: 'Tháng kết thúc', group: 'Nhiệm vụ' },
  { key: 'nam_ket_thuc', label: 'Năm kết thúc', group: 'Nhiệm vụ' },

  { key: 'ten_ben_a', label: 'Tên Bên A', group: 'Bên A' },
  { key: 'dai_dien_ben_a', label: 'Đại diện Bên A', group: 'Bên A' },
  { key: 'chuc_vu_dai_dien_ben_a', label: 'Chức vụ đại diện Bên A', group: 'Bên A' },
  { key: 'dia_chi_ben_a', label: 'Địa chỉ Bên A', group: 'Bên A' },
  { key: 'dien_thoai_ben_a', label: 'Điện thoại Bên A', group: 'Bên A' },
  { key: 'email_ben_a', label: 'Email Bên A', group: 'Bên A' },

  { key: 'ten_ben_b', label: 'Tên Bên B', group: 'Bên B' },
  { key: 'dai_dien_ben_b', label: 'Đại diện Bên B', group: 'Bên B' },
  { key: 'chuc_vu_dai_dien_ben_b', label: 'Chức vụ đại diện Bên B', group: 'Bên B' },
  { key: 'dia_chi_ben_b', label: 'Địa chỉ Bên B', group: 'Bên B' },
  { key: 'dien_thoai_ben_b', label: 'Điện thoại Bên B', group: 'Bên B' },
  { key: 'email_ben_b', label: 'Email Bên B', group: 'Bên B' },
  { key: 'so_tai_khoan_ben_b', label: 'Số tài khoản Bên B', group: 'Bên B' },
  { key: 'ngan_hang_ben_b', label: 'Ngân hàng Bên B', group: 'Bên B' },

  { key: 'hinh_thuc_khoan_chi', label: 'Hình thức khoán chi', group: 'Kinh phí' },
  { key: 'tong_kinh_phi', label: 'Tổng kinh phí', group: 'Kinh phí' },
  { key: 'tong_kinh_phi_bang_chu', label: 'Tổng kinh phí bằng chữ', group: 'Kinh phí' },
  { key: 'kinh_phi_nsnn', label: 'Kinh phí NSNN', group: 'Kinh phí' },
  { key: 'kinh_phi_nsnn_bang_chu', label: 'Kinh phí NSNN bằng chữ', group: 'Kinh phí' },
  { key: 'kinh_phi_khoan', label: 'Kinh phí khoán', group: 'Kinh phí' },
  { key: 'kinh_phi_khoan_bang_chu', label: 'Kinh phí khoán bằng chữ', group: 'Kinh phí' },
  { key: 'kinh_phi_khong_giao_khoan', label: 'Kinh phí không giao khoán', group: 'Kinh phí' },
  { key: 'kinh_phi_khong_giao_khoan_bang_chu', label: 'Kinh phí không giao khoán bằng chữ', group: 'Kinh phí' },
  { key: 'kinh_phi_nguon_khac', label: 'Kinh phí nguồn khác', group: 'Kinh phí' },
  { key: 'kinh_phi_nguon_khac_bang_chu', label: 'Kinh phí nguồn khác bằng chữ', group: 'Kinh phí' },

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
