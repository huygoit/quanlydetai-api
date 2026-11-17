/**
 * Danh mục biến merge thuyết minh BM-02.02.
 * Khớp file BM-02.02_Thuyet_minh_co_bien.docx (delimiter {{...}}).
 */
export type Bm0202VariableDef = {
  key: string
  label: string
  group: string
}

export const BM0202_TEMPLATE_VARIABLES: Bm0202VariableDef[] = [
  // Phần đầu / ngày tháng
  { key: 'ngay_lap', label: 'Ngày lập (số ngày)', group: 'Phần đầu' },
  { key: 'thang_lap', label: 'Tháng lập', group: 'Phần đầu' },
  { key: 'nam_lap', label: 'Năm lập', group: 'Phần đầu' },
  { key: 'ma_bieu_mau', label: 'Mã biểu mẫu', group: 'Phần đầu' },
  { key: 'phien_ban', label: 'Phiên bản biểu mẫu', group: 'Phần đầu' },

  // 1. Tên nhiệm vụ
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ', group: '1. Tên nhiệm vụ' },
  { key: 'ma_so_nhiem_vu', label: 'Mã số nhiệm vụ', group: '1. Tên nhiệm vụ' },
  { key: 'ten_cum_chuoi', label: 'Tên cụm/chuỗi nhiệm vụ (nếu có)', group: '1. Tên nhiệm vụ' },
  { key: 'linh_vuc', label: 'Lĩnh vực', group: '1. Tên nhiệm vụ' },
  { key: 'cap_quan_ly', label: 'Cấp quản lý', group: '1. Tên nhiệm vụ' },

  // 2–3
  { key: 'to_chuc_chu_tri', label: 'Tổ chức/đơn vị chủ trì (tóm tắt)', group: '2. Tổ chức chủ trì' },
  { key: 'so_thang', label: 'Thời gian thực hiện (tháng)', group: '3. Thời gian' },
  { key: 'ngay_bat_dau', label: 'Ngày bắt đầu', group: '3. Thời gian' },
  { key: 'ngay_ket_thuc', label: 'Ngày kết thúc', group: '3. Thời gian' },

  // 4. Kinh phí
  { key: 'tong_kinh_phi', label: 'Tổng kinh phí', group: '4. Kinh phí' },
  { key: 'tong_kinh_phi_bang_chu', label: 'Tổng kinh phí bằng chữ', group: '4. Kinh phí' },
  { key: 'kp_tu_truong', label: 'Kinh phí từ Trường', group: '4. Kinh phí' },
  { key: 'kp_ngoai_truong', label: 'Kinh phí ngoài Trường', group: '4. Kinh phí' },
  { key: 'kp_ngoai_truong_nn_dia_phuong', label: 'Ngoài trường — NN/địa phương', group: '4. Kinh phí' },
  { key: 'kp_ngoai_truong_dn', label: 'Ngoài trường — doanh nghiệp', group: '4. Kinh phí' },
  { key: 'kp_ngoai_truong_tai_tro', label: 'Ngoài trường — tài trợ', group: '4. Kinh phí' },
  { key: 'kp_ngoai_truong_khac', label: 'Ngoài trường — nguồn khác', group: '4. Kinh phí' },
  { key: 'kp_nsnn', label: 'Ngân sách nhà nước', group: '4. Kinh phí' },
  { key: 'kp_ngoai_nsnn', label: 'Ngoài ngân sách nhà nước', group: '4. Kinh phí' },

  // 5. Khoán chi
  { key: 'hinh_thuc_khoan_chi', label: 'Hình thức khoán chi (mô tả)', group: '5. Khoán chi' },
  { key: 'tick_khoan_sp_cuoi', label: 'Tick khoán đến SP cuối (☑/☐)', group: '5. Khoán chi' },
  { key: 'tick_khoan_tung_phan', label: 'Tick khoán từng phần (☑/☐)', group: '5. Khoán chi' },
  { key: 'kp_khoan', label: 'Kinh phí khoán', group: '5. Khoán chi' },
  { key: 'kp_khong_khoan', label: 'Kinh phí không khoán', group: '5. Khoán chi' },

  // 6. Chủ nhiệm
  { key: 'cn_ho_ten', label: 'Họ và tên chủ nhiệm', group: '6. Chủ nhiệm' },
  { key: 'cn_cccd', label: 'Số định danh cá nhân', group: '6. Chủ nhiệm' },
  { key: 'cn_ngay_sinh', label: 'Ngày sinh', group: '6. Chủ nhiệm' },
  { key: 'cn_gioi_tinh', label: 'Giới tính (Nam/Nữ)', group: '6. Chủ nhiệm' },
  { key: 'tick_nam', label: 'Tick Nam (☑/☐)', group: '6. Chủ nhiệm' },
  { key: 'tick_nu', label: 'Tick Nữ (☑/☐)', group: '6. Chủ nhiệm' },
  { key: 'cn_hoc_ham_hoc_vi', label: 'Học hàm, học vị', group: '6. Chủ nhiệm' },
  { key: 'cn_chuc_danh', label: 'Chức danh nghề nghiệp', group: '6. Chủ nhiệm' },
  { key: 'cn_chuc_vu', label: 'Chức vụ', group: '6. Chủ nhiệm' },
  { key: 'cn_dien_thoai', label: 'Điện thoại chủ nhiệm', group: '6. Chủ nhiệm' },
  { key: 'cn_email', label: 'Email chủ nhiệm', group: '6. Chủ nhiệm' },
  { key: 'cn_to_chuc', label: 'Tổ chức đang công tác', group: '6. Chủ nhiệm' },
  { key: 'cn_dia_chi_cong_tac', label: 'Địa chỉ công tác', group: '6. Chủ nhiệm' },

  // 7. Tổ chức chủ trì
  { key: 'tc_ten', label: 'Tên tổ chức chủ trì', group: '7. Tổ chức chủ trì' },
  { key: 'tc_ma_so', label: 'Mã số tổ chức', group: '7. Tổ chức chủ trì' },
  { key: 'tc_dien_thoai', label: 'Điện thoại tổ chức', group: '7. Tổ chức chủ trì' },
  { key: 'tc_dia_chi', label: 'Địa chỉ tổ chức', group: '7. Tổ chức chủ trì' },
  { key: 'tc_thu_truong', label: 'Họ tên thủ trưởng tổ chức', group: '7. Tổ chức chủ trì' },
  { key: 'tc_nang_luc', label: 'Năng lực, kinh nghiệm tổ chức', group: '7. Tổ chức chủ trì' },
  { key: 'tc_doi_ngu', label: 'Đội ngũ nhân lực thực hiện', group: '7. Tổ chức chủ trì' },

  // 8. Tổ chức phối hợp (tối đa 5 + khối văn bản)
  { key: 'danh_sach_to_chuc_phoi_hop', label: 'Danh sách tổ chức phối hợp (văn bản)', group: '8. Phối hợp' },
  { key: 'tcp_1_ten', label: 'Tổ chức phối hợp 1 — tên', group: '8. Phối hợp' },
  { key: 'tcp_1_ma_so', label: 'Tổ chức phối hợp 1 — mã số', group: '8. Phối hợp' },
  { key: 'tcp_1_dien_thoai', label: 'Tổ chức phối hợp 1 — ĐT', group: '8. Phối hợp' },
  { key: 'tcp_1_dia_chi', label: 'Tổ chức phối hợp 1 — địa chỉ', group: '8. Phối hợp' },
  { key: 'tcp_2_ten', label: 'Tổ chức phối hợp 2 — tên', group: '8. Phối hợp' },
  { key: 'tcp_2_ma_so', label: 'Tổ chức phối hợp 2 — mã số', group: '8. Phối hợp' },
  { key: 'tcp_2_dien_thoai', label: 'Tổ chức phối hợp 2 — ĐT', group: '8. Phối hợp' },
  { key: 'tcp_2_dia_chi', label: 'Tổ chức phối hợp 2 — địa chỉ', group: '8. Phối hợp' },
  { key: 'tcp_3_ten', label: 'Tổ chức phối hợp 3 — tên', group: '8. Phối hợp' },
  { key: 'tcp_3_ma_so', label: 'Tổ chức phối hợp 3 — mã số', group: '8. Phối hợp' },
  { key: 'tcp_3_dien_thoai', label: 'Tổ chức phối hợp 3 — ĐT', group: '8. Phối hợp' },
  { key: 'tcp_3_dia_chi', label: 'Tổ chức phối hợp 3 — địa chỉ', group: '8. Phối hợp' },

  // 9–11 nội dung mô tả
  { key: 'tinh_cap_thiet', label: 'Tính cấp thiết', group: '9–11. Nội dung' },
  { key: 'muc_tieu', label: 'Mục tiêu', group: '9–11. Nội dung' },
  { key: 'noi_dung_phuong_phap', label: 'Nội dung và phương pháp thực hiện', group: '9–11. Nội dung' },
  { key: 'bang_tien_do', label: 'Bảng tiến độ / nội dung thực hiện', group: '9–11. Nội dung' },

  // 12. Kết quả dự kiến (bảng dạng văn bản)
  { key: 'bang_cong_bo', label: 'Bảng 12.1 Công bố khoa học', group: '12. Kết quả dự kiến' },
  { key: 'bang_san_pham_ung_dung', label: 'Bảng 12.2 Sản phẩm nguyên lý/ứng dụng', group: '12. Kết quả dự kiến' },
  { key: 'bang_san_pham_mau', label: 'Bảng 12.3 Mẫu/sản phẩm/thiết bị', group: '12. Kết quả dự kiến' },
  { key: 'bang_shtt', label: 'Bảng 12.4 Đăng ký SHTT', group: '12. Kết quả dự kiến' },
  { key: 'bang_dao_tao', label: 'Bảng 12.5 Đào tạo sau ĐH', group: '12. Kết quả dự kiến' },

  // 13–14, 16–17
  { key: 'kha_nang_ung_dung', label: 'Khả năng ứng dụng và chuyển giao', group: '13–17. Khác' },
  { key: 'hieu_qua_dau_ra', label: 'Dự kiến hiệu quả đầu ra', group: '13–17. Khác' },
  { key: 'tac_dong_ket_qua', label: 'Dự kiến tác động kết quả', group: '13–17. Khác' },
  { key: 'bang_du_toan', label: 'Bảng dự toán kinh phí (§15)', group: '15. Dự toán' },
  { key: 'quan_ly_rui_ro', label: 'Quản lý rủi ro và kiểm soát', group: '13–17. Khác' },
  { key: 'yeu_cau_dao_duc', label: 'Đạo đức nghiên cứu / chấp thuận', group: '13–17. Khác' },
  { key: 'yeu_cau_shtt', label: 'SHTT / quyền bên thứ ba', group: '13–17. Khác' },
  { key: 'yeu_cau_ai', label: 'Sử dụng trí tuệ nhân tạo', group: '13–17. Khác' },
  { key: 'yeu_cau_dac_thu_khac', label: 'Yêu cầu đặc thù khác', group: '13–17. Khác' },

  // Chữ ký
  { key: 'chu_ky_chu_nhiem', label: 'Họ tên ký — chủ nhiệm', group: 'Chữ ký' },
  { key: 'chu_ky_dai_dien_to_chuc', label: 'Họ tên ký — đại diện tổ chức', group: 'Chữ ký' },
]
