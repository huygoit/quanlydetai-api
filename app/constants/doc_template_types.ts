/**
 * Loại mẫu DOCX trong Module 5 (hợp đồng, thanh lý, …).
 */
export type DocTemplateTypeCode = 'HOP_DONG' | 'THANH_LY'

export type DocTemplateTypeDef = {
  code: DocTemplateTypeCode
  label: string
  /** Mã biểu mẫu gợi ý (BM.06, …) — không bắt buộc */
  defaultFormCode: string | null
  description: string
}

export const DOC_TEMPLATE_TYPES: DocTemplateTypeDef[] = [
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
    description: 'Biên bản thanh lý sau khi kết thúc / nghiệm thu nhiệm vụ',
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
  if (c === 'BM06' || c === 'HOP_DONG') return 'HOP_DONG'
  if (c === 'THANH_LY' || c === 'BBTL') return 'THANH_LY'
  return 'HOP_DONG'
}
