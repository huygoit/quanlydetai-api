export type StartupProjectHeaderKey =
  | 'stt'
  | 'project_title'
  | 'member_name'
  | 'faculty_name'
  | 'unit_code'
  | 'unit_name'
  | 'role'
  | 'advisor_name'
  | 'field_name'
  | 'short_description'
  | 'member_list'
  | 'year'

const HEADER_ALIASES: Record<StartupProjectHeaderKey, string[]> = {
  stt: ['STT', 'stt'],
  project_title: ['Tên dự án', 'ten du an', 'Tên đề tài', 'ten de tai'],
  member_name: ['Thành viên dự án', 'thanh vien du an', 'Họ và tên', 'ho va ten', 'Thành viên', 'thanh vien'],
  faculty_name: ['Khoa', 'khoa'],
  unit_code: ['donvi_ma', 'đơn vị mã', 'don vi ma'],
  unit_name: ['donvi_ten', 'đơn vị tên', 'don vi ten'],
  role: ['Vai trò', 'vai tro', 'Vai trò ', 'vai tro '],
  advisor_name: [
    'Cố vấn (nếu có)',
    'co van',
    'cố vấn',
    'co van (neu co)',
    'HD',
    'hd',
    'Cố vấn đề tài (nếu có)',
    'co van de tai (neu co)',
  ],
  field_name: ['Lĩnh vực', 'linh vuc', 'Lĩnh vực dự thi', 'linh vuc du thi'],
  short_description: ['Mô tả ngắn gọn các dự án', 'mo ta ngan gon cac du an', 'Tóm Tắt', 'tom tat', 'Tóm tắt', 'tóm tắt'],
  member_list: ['Thành viên', 'thanh vien'],
  year: ['Năm', 'nam', 'Năm ', 'nam '],
}

function normalize(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default class StartupProjectHeaderResolver {
  private readonly keyToHeader = new Map<StartupProjectHeaderKey, string>()

  constructor(headers: string[]) {
    const normalizedToRaw = new Map<string, string>()
    for (const h of headers) {
      const n = normalize(h)
      if (!normalizedToRaw.has(n)) normalizedToRaw.set(n, h)
    }

    for (const key of Object.keys(HEADER_ALIASES) as StartupProjectHeaderKey[]) {
      const aliases = HEADER_ALIASES[key]
      for (const alias of aliases) {
        const raw = normalizedToRaw.get(normalize(alias))
        if (raw) {
          this.keyToHeader.set(key, raw)
          break
        }
      }
    }
  }

  get(row: Record<string, unknown>, key: StartupProjectHeaderKey): string {
    const header = this.keyToHeader.get(key)
    if (!header) return ''
    const value = row[header]
    if (value === undefined || value === null) return ''
    return String(value).replace(/\s+/g, ' ').trim()
  }
}
