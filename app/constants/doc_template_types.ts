/**
 * Loại mẫu DOCX trong Module 5 (hợp đồng, thanh lý, thuyết minh…).
 */
export type DocTemplateTypeCode =
  | 'HOP_DONG'
  | 'THANH_LY'
  | 'THONG_BAO'
  | 'QUYET_DINH'
  | 'THUYET_MINH'
  | 'DON_DE_NGHI'
  | 'BAO_CAO_TONG_KET'

export type DocTemplateTypeDef = {
  code: DocTemplateTypeCode
  label: string
  /** Mã biểu mẫu gợi ý (BM.06, …) — không bắt buộc */
  defaultFormCode: string | null
  description: string
}

export const DOC_TEMPLATE_TYPES: DocTemplateTypeDef[] = [
  {
    code: 'THUYET_MINH',
    label: 'Thuyết minh nhiệm vụ',
    defaultFormCode: 'BM0202',
    description: 'Thuyết minh nhiệm vụ KHCN & ĐMST (BM-02.02)',
  },
  {
    code: 'HOP_DONG',
    label: 'Hợp đồng',
    defaultFormCode: 'BM06',
    description: 'Hợp đồng thực hiện nhiệm vụ (BM.06)',
  },
  {
    code: 'THANH_LY',
    label: 'Biên bản thanh lý hợp đồng',
    defaultFormCode: null,
    description: 'Biên bản thanh lý sau khi kết thúc nhiệm vụ',
  },
  {
    code: 'THONG_BAO',
    label: 'Thông báo',
    defaultFormCode: 'TB',
    description: 'Thông báo tuyển chọn tổ chức, cá nhân chủ trì đề tài',
  },
  {
    code: 'QUYET_DINH',
    label: 'Quyết định',
    defaultFormCode: 'QD',
    description: 'Quyết định thành lập Hội đồng thẩm định thuyết minh',
  },
  {
    code: 'DON_DE_NGHI',
    label: 'Đơn đề nghị đánh giá kết quả nhiệm vụ',
    defaultFormCode: 'BM0501',
    description: 'Đơn đề nghị đánh giá kết quả thực hiện nhiệm vụ KHCN&ĐMST (BM-05.01)',
  },
  {
    code: 'BAO_CAO_TONG_KET',
    label: 'Báo cáo tổng kết kết quả nhiệm vụ',
    defaultFormCode: 'BM0502',
    description: 'Báo cáo tổng kết kết quả thực hiện nhiệm vụ KHCN&ĐMST (BM-05.02)',
  },
]

export const DOC_TEMPLATE_TYPE_CODES = DOC_TEMPLATE_TYPES.map((t) => t.code) as [
  DocTemplateTypeCode,
  ...DocTemplateTypeCode[],
]

export function isDocTemplateType(value: string): value is DocTemplateTypeCode {
  return DOC_TEMPLATE_TYPE_CODES.includes(value as DocTemplateTypeCode)
}

export function getDocTemplateType(code: string): DocTemplateTypeDef | undefined {
  return DOC_TEMPLATE_TYPES.find((t) => t.code === code)
}

/** Map dữ liệu cũ form_code → loại */
export function mapLegacyFormCodeToTemplateType(formCode: string | null | undefined): DocTemplateTypeCode {
  const c = (formCode || '').toUpperCase()
  if (c === 'BM0202' || c === 'BM-02.02' || c === 'THUYET_MINH' || c === 'TM') return 'THUYET_MINH'
  if (c === 'BM06' || c === 'HOP_DONG') return 'HOP_DONG'
  if (c === 'THANH_LY' || c === 'BBTL') return 'THANH_LY'
  if (c === 'THONG_BAO' || c === 'TB') return 'THONG_BAO'
  if (c === 'QUYET_DINH' || c === 'QD' || c === 'QD_HDD') return 'QUYET_DINH'
  if (
    c === 'DON_DE_NGHI' ||
    c === 'BM0501' ||
    c === 'BM-05.01' ||
    c === 'BM05.01'
  ) {
    return 'DON_DE_NGHI'
  }
  if (
    c === 'BAO_CAO_TONG_KET' ||
    c === 'BM0502' ||
    c === 'BM-05.02' ||
    c === 'BM05.02'
  ) {
    return 'BAO_CAO_TONG_KET'
  }
  return 'HOP_DONG'
}
