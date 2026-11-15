/**
 * 14 khoản chi dùng chung (hợp đồng / tạm ứng / sổ chi…).
 * Mục 2 tách Trong nước / Nước ngoài để chọn trên form.
 */

export type KhoanChiDef = {
  code: string
  stt: number
  label: string
  /** Nhóm cha khi là dòng con (vd. thuê chuyên gia) */
  group?: string
  /** Mục quản lý chung ≤ 5% tổng */
  isQuanLyChung?: boolean
}

export const KHOAN_CHI: KhoanChiDef[] = [
  {
    code: 'MUC_01',
    stt: 1,
    label: 'Chi thù lao thực hiện nhiệm vụ',
  },
  {
    code: 'MUC_02A',
    stt: 2,
    label: 'Thuê chuyên gia - Trong nước',
    group: 'MUC_02',
  },
  {
    code: 'MUC_02B',
    stt: 2,
    label: 'Thuê chuyên gia - Nước ngoài',
    group: 'MUC_02',
  },
  {
    code: 'MUC_03',
    stt: 3,
    label: 'Nguyên liệu, nhiên liệu, mẫu vật',
  },
  {
    code: 'MUC_04',
    stt: 4,
    label: 'Sửa chữa, mua sắm, thuê tài sản',
  },
  {
    code: 'MUC_05',
    stt: 5,
    label: 'Công tác tổ chức, tham gia hội nghị',
  },
  {
    code: 'MUC_06',
    stt: 6,
    label: 'Dịch vụ thuê ngoài',
  },
  {
    code: 'MUC_07',
    stt: 7,
    label: 'Điều tra, khảo sát thu thập số liệu',
  },
  {
    code: 'MUC_08',
    stt: 8,
    label: 'Văn phòng phẩm, thông tin liên lạc, in ấn',
  },
  {
    code: 'MUC_09',
    stt: 9,
    label: 'Công bố công trình khoa học và công nghệ trong nước và quốc tế',
  },
  {
    code: 'MUC_10',
    stt: 10,
    label: 'Tự đánh giá kết quả thực hiện nhiệm vụ',
  },
  {
    code: 'MUC_11',
    stt: 11,
    label:
      'Tư vấn xây dựng hồ sơ đăng ký bảo hộ quyền sở hữu trí tuệ ở trong nước và nước ngoài',
  },
  {
    code: 'MUC_12',
    stt: 12,
    label: 'Phổ biến, tuyên truyền kết quả của nhiệm vụ',
  },
  {
    code: 'MUC_13',
    stt: 13,
    label: 'Công tác quản lý chung nhiệm vụ (bằng 5% tổng kinh phí thực hiện)',
    isQuanLyChung: true,
  },
  {
    code: 'MUC_14',
    stt: 14,
    label: 'Chi khác có liên quan trực tiếp đến triển khai thực hiện nhiệm vụ',
  },
]

export const KHOAN_CHI_CODES = KHOAN_CHI.map((k) => k.code)

export const KHOAN_CHI_QUAN_LY = 'MUC_13'

/** Mã dùng cho đề nghị mua sắm */
export const KHOAN_CHI_MUA_SAM = ['MUC_03', 'MUC_04', 'MUC_06'] as const

export function nhanKhoanChi(code: string) {
  const hit = KHOAN_CHI.find((k) => k.code === code)
  if (!hit) return code
  return `${hit.stt}. ${hit.label}`
}

export function laKhoanChiHopLe(code: string) {
  return KHOAN_CHI_CODES.includes(code)
}
