export type ProjectHeaderKey =
  | 'project_code'
  | 'project_title'
  | 'member_name'
  | 'member_code'
  | 'email'
  | 'department_name'
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
  project_title: ['project_title', 'ten_de_tai', 'tên đề tài', 'tên nhiệm vụ', 'ten nhiem vu', 'ten du an', 'tên dự án'],
  member_name: ['member_name', 'ho_ten', 'họ tên', 'thành viên', 'ten thanh vien', 'họ tên sinh viên', 'họ và tên', 'ho va ten'],
  member_code: ['member_code', 'mssv', 'ma_sv', 'mã sinh viên', 'ma can bo', 'mã cán bộ', 'lop', 'lớp', 'nn'],
  email: ['email', 'mail', 'e-mail'],
  department_name: ['department_name', 'bo_mon', 'bộ môn', 'department', 'đơn vị', 'khoa'],
  field_name: ['field_name', 'linh_vuc', 'lĩnh vực'],
  academic_year: ['academic_year', 'nam_hoc', 'năm học'],
  year: ['year', 'nam', 'năm'],
  role: ['role', 'vai_tro', 'vai trò', 'vai tro'],
  level: ['level', 'cap_de_tai', 'cấp đề tài'],
  status: ['status', 'trang_thai', 'trạng thái'],
  summary: ['summary', 'tom_tat', 'tóm tắt'],
  objectives: ['objectives', 'muc_tieu', 'mục tiêu'],
  expected_results: ['expected_results', 'ket_qua_du_kien', 'sản phẩm dự kiến', 'kết quả dự kiến'],
  budget_total: ['budget_total', 'kinh_phi', 'kinh phí', 'tong_kinh_phi'],
  start_date: ['start_date', 'ngay_bat_dau', 'ngày bắt đầu'],
  end_date: ['end_date', 'ngay_ket_thuc', 'ngày kết thúc'],
  note: ['note', 'ghi_chu', 'ghi chú'],
  leader_name: ['leader_name', 'chu_nhiem', 'chủ nhiệm', 'gvhd', 'giảng viên hướng dẫn', 'hd'],
  leader_unit: ['leader_unit', 'don_vi', 'đơn vị'],
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
