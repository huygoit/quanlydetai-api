/**
 * Biến merge mẫu Quyết định thành lập HĐ thẩm định thuyết minh.
 * Khớp file Quyet_dinh_thanh_lap_Hoi_dong_TEMPLATE.docx — dùng {{ten_bien}}.
 */
import type { Bm06VariableDef } from '#constants/bm06_template_variables'

export const QUYET_DINH_TEMPLATE_VARIABLES: Bm06VariableDef[] = [
  { key: 'so_quyet_dinh', label: 'Số quyết định', group: 'Văn bản' },
  { key: 'ngay_ban_hanh', label: 'Ngày ban hành (vd: ngày 04 tháng 11 năm 2026)', group: 'Văn bản' },
  {
    key: 'van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen',
    label: 'Văn bản quy định chức năng, nhiệm vụ, thẩm quyền',
    group: 'Căn cứ',
  },
  {
    key: 'quy_dinh_quan_ly_nhiem_vu_khcn_dmst',
    label: 'Quy định quản lý nhiệm vụ KHCN&ĐMST',
    group: 'Căn cứ',
  },
  {
    key: 'van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh',
    label: 'Văn bản phê duyệt danh mục / kế hoạch thẩm định',
    group: 'Căn cứ',
  },
  { key: 'chuc_danh_nguoi_de_nghi', label: 'Chức danh người đề nghị', group: 'Căn cứ' },
  { key: 'don_vi_dau_moi', label: 'Đơn vị đầu mối thi hành', group: 'Điều 3' },
  { key: 'don_vi_luu_ho_so', label: 'Đơn vị lưu hồ sơ', group: 'Nơi nhận' },
  { key: 'ho_ten_nguoi_ky', label: 'Họ tên người ký (Hiệu trưởng)', group: 'Văn bản' },
  { key: 'so_thanh_vien', label: 'Số thành viên hội đồng', group: 'Phiên họp' },
  { key: 'ma_thuyet_minh', label: 'Mã thuyết minh (chính / danh sách)', group: 'Phiên họp' },
  { key: 'ten_nhiem_vu', label: 'Tên nhiệm vụ / đề tài', group: 'Phiên họp' },
  { key: 'thoi_gian_hop', label: 'Thời gian họp', group: 'Phiên họp' },
  { key: 'dia_diem', label: 'Địa điểm họp', group: 'Phiên họp' },
  { key: 'ma_du_thao', label: 'Mã dự thảo QĐ trên hệ thống', group: 'Phiên họp' },
  {
    key: 'danh_sach_hoi_dong',
    label: 'Danh sách hội đồng (mỗi dòng: STT. Họ tên — Đơn vị — Vai trò)',
    group: 'Phụ lục',
  },
]

export type QuyetDinhMergeConfig = {
  van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen: string
  quy_dinh_quan_ly_nhiem_vu_khcn_dmst: string
  van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh: string
  chuc_danh_nguoi_de_nghi: string
  don_vi_dau_moi: string
  don_vi_luu_ho_so: string
  ho_ten_nguoi_ky: string
  so_moi_nhat: number
}

export const QUYET_DINH_MERGE_TRONG: QuyetDinhMergeConfig = {
  van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen:
    'Nghị quyết của Hội đồng trường về Quy chế tổ chức và hoạt động của Trường Đại học Sư phạm - Đại học Đà Nẵng',
  quy_dinh_quan_ly_nhiem_vu_khcn_dmst:
    'Quy định quản lý nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo của Trường Đại học Sư phạm - Đại học Đà Nẵng',
  van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh:
    'Kế hoạch tổ chức thẩm định thuyết minh nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo',
  chuc_danh_nguoi_de_nghi: 'Trưởng phòng Khoa học và Hợp tác quốc tế',
  don_vi_dau_moi: 'Phòng Khoa học và Hợp tác quốc tế',
  don_vi_luu_ho_so: 'PKH&HTQT',
  ho_ten_nguoi_ky: '',
  so_moi_nhat: 0,
}

export function chuanCauHinhQuyetDinh(
  raw: Partial<QuyetDinhMergeConfig> | null | undefined
): QuyetDinhMergeConfig {
  const cat = (v: string | undefined, dai: number) => (v || '').trim().slice(0, dai)
  const so = Number(raw?.so_moi_nhat)
  const lay = (k: keyof QuyetDinhMergeConfig, dai: number) => {
    const tuForm = cat(raw?.[k] as string | undefined, dai)
    if (tuForm) return tuForm
    return cat(QUYET_DINH_MERGE_TRONG[k] as string, dai)
  }
  return {
    van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen: lay(
      'van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen',
      2000
    ),
    quy_dinh_quan_ly_nhiem_vu_khcn_dmst: lay('quy_dinh_quan_ly_nhiem_vu_khcn_dmst', 2000),
    van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh: lay(
      'van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh',
      2000
    ),
    chuc_danh_nguoi_de_nghi: lay('chuc_danh_nguoi_de_nghi', 255) || QUYET_DINH_MERGE_TRONG.chuc_danh_nguoi_de_nghi,
    don_vi_dau_moi: lay('don_vi_dau_moi', 255) || QUYET_DINH_MERGE_TRONG.don_vi_dau_moi,
    don_vi_luu_ho_so: lay('don_vi_luu_ho_so', 255) || QUYET_DINH_MERGE_TRONG.don_vi_luu_ho_so,
    ho_ten_nguoi_ky: cat(raw?.ho_ten_nguoi_ky, 255),
    so_moi_nhat: Number.isFinite(so) && so > 0 ? Math.floor(so) : 0,
  }
}
