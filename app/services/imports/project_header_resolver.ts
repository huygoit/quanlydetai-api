export type ProjectHeaderKey =
  | 'project_code'
  | 'project_title'
  | 'member_name'
  | 'member_code'
  | 'email'
  | 'department_name'
  | 'department_code'
  | 'field_name'
  | 'academic_year'
  | 'year'
  | 'role'
  | 'level'
  | 'status'
  | 'summary'
  | 'objectives'
  | 'expected_results'
  | 'budget_total'
  | 'start_date'
  | 'end_date'
  | 'note'
  | 'leader_name'
  | 'leader_unit'

const HEADER_ALIASES: Record<ProjectHeaderKey, string[]> = {
  project_code: ['project_code', 'ma_de_tai', 'mã đề tài', 'ma dt', 'ma du an', 'mã dự án'],
  project_title: [
    'project_title',
    'ten_de_tai',
    /* Trang SV NCKH: nhiều khối chỉ điền cột Detai_name, để trống Tên đề tài — ưu tiên detai_name khi có */
    'detai_name',
    'tên đề tài',
    'tên nhiệm vụ',
    'ten nhiem vu',
    'ten du an',
    'tên dự án',
    'ten du an khoi nghiep',
    'tên dự án khởi nghiệp',
  ],
  member_name: [
    'member_name',
    'ho_ten',
    'họ tên',
    'thành viên',
    'ten thanh vien',
    'họ tên sinh viên',
    'họ và tên',
    'ho va ten',
    'thành viên dự án',
    'thanh vien du an',
    'sv/nhom sv thuc hien',
    'sv/nhóm sv thực hiện',
  ],
  member_code: [
    'member_code',
    'mssv',
    'ma_sv',
    'mã sinh viên',
    'ma can bo',
    'mã cán bộ',
    'lop',
    'lớp',
    'nn',
    'mã số sinh viên',
    'ma so sinh vien',
  ],
  email: ['email', 'mail', 'e-mail'],
  department_name: [
    'department_name',
    'bo_mon',
    'bộ môn',
    'department',
    'đơn vị',
    'khoa',
    'donvi_ten',
    'đơn vị tên',
    'don vi ten',
    'donvi_name',
    'don vi name',
    'donvi_cu',
    'don vi cu',
  ],
  department_code: [
    'department_code',
    'donvi_ma',
    'don vi ma',
    'đơn vị mã',
    'ma_don_vi',
    'mã đơn vị',
    'ma don vi',
    'unit_code',
    'unit code',
  ],
  field_name: ['field_name', 'linh_vuc', 'lĩnh vực'],
  academic_year: ['academic_year', 'nam_hoc', 'năm học'],
  year: ['year', 'nam', 'năm'],
  role: ['role', 'vai_tro', 'vai trò', 'vai tro'],
  level: ['level', 'cap_de_tai', 'cấp đề tài'],
  status: ['status', 'trang_thai', 'trạng thái'],
  summary: ['summary', 'tom_tat', 'tóm tắt', 'mô tả ngắn gọn các dự án', 'mo ta ngan gon cac du an', 'mo ta ngan'],
  objectives: ['objectives', 'muc_tieu', 'mục tiêu'],
  expected_results: ['expected_results', 'ket_qua_du_kien', 'sản phẩm dự kiến', 'kết quả dự kiến'],
  budget_total: ['budget_total', 'kinh_phi', 'kinh phí', 'tong_kinh_phi'],
  start_date: ['start_date', 'ngay_bat_dau', 'ngày bắt đầu'],
  end_date: ['end_date', 'ngay_ket_thuc', 'ngày kết thúc'],
  note: [
    'note',
    'ghi_chu',
    'ghi chú',
    'ghi chu',
  ],
  leader_name: [
    'leader_name',
    'chu_nhiem',
    'chủ nhiệm',
    'gvhd',
    'giảng viên hướng dẫn',
    'hd',
    'người hướng dẫn',
    'nguoi huong dan',
    'cố vấn (nếu có)',
    'co van (neu co)',
    'cố vấn',
    'co van',
  ],
  // Tránh trùng cột "đơn vị" với department_name (ưu tiên map đơn vị đề tài)
  leader_unit: ['leader_unit', 'don_vi_gvhd', 'don vi gvhd'],
}

function normalize(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default class ProjectHeaderResolver {
  private readonly mapping = new Map<ProjectHeaderKey, string>()

  constructor(headers: string[]) {
    const normalizedHeaderMap = new Map<string, string>()
    for (const header of headers) {
      const n = normalize(header)
      if (!normalizedHeaderMap.has(n)) normalizedHeaderMap.set(n, header)
    }

    for (const key of Object.keys(HEADER_ALIASES) as ProjectHeaderKey[]) {
      const aliases = HEADER_ALIASES[key]
      for (const alias of aliases) {
        const hit = normalizedHeaderMap.get(normalize(alias))
        if (hit) {
          this.mapping.set(key, hit)
          break
        }
      }
    }
  }

  value(row: Record<string, unknown>, key: ProjectHeaderKey): string {
    const header = this.mapping.get(key)
    if (!header) return ''
    const raw = row[header]
    if (raw === undefined || raw === null) return ''
    return String(raw).replace(/\s+/g, ' ').trim()
  }
}
