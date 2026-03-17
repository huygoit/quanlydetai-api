export type ProjectResearchHeaderKey =
  | 'code'
  | 'title'
  | 'leader_name'
  | 'leader_code'
  | 'unit_name'
  | 'unit_code'
  | 'budget_total'
  | 'start_date'
  | 'end_date'
  | 'is_extended'
  | 'extended_time'
  | 'approval_status'
  | 'project_status'
  | 'acceptance_year'

const HEADER_ALIASES: Record<ProjectResearchHeaderKey, string[]> = {
  code: ['nckh_id'],
  title: ['nckh_name'],
  leader_name: ['chu_nhiem_ten', 'ten_xuly'],
  leader_code: ['chu_nhiem_id'],
  unit_name: ['don_vi_name'],
  unit_code: ['don_vi_id'],
  budget_total: ['kinhphi_pheduyet'],
  start_date: ['thoigian_batdau'],
  end_date: ['thoigian_ketthuc'],
  is_extended: ['is_giahan'],
  extended_time: ['thoigian_giahan'],
  approval_status: ['trangthai_pheduyet'],
  project_status: ['trangthaiDeTai'],
  acceptance_year: ['Năm nghiệm thu'],
}

function normalize(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default class ProjectResearchHeaderResolver {
  private readonly keyToHeader = new Map<ProjectResearchHeaderKey, string>()

  constructor(headers: string[]) {
    const normalizedToRaw = new Map<string, string>()
    for (const header of headers) {
      const n = normalize(header)
      if (!normalizedToRaw.has(n)) normalizedToRaw.set(n, header)
    }

    for (const key of Object.keys(HEADER_ALIASES) as ProjectResearchHeaderKey[]) {
      for (const alias of HEADER_ALIASES[key]) {
        const hit = normalizedToRaw.get(normalize(alias))
        if (hit) {
          this.keyToHeader.set(key, hit)
          break
        }
      }
    }
  }

  value(row: Record<string, unknown>, key: ProjectResearchHeaderKey): string {
    const header = this.keyToHeader.get(key)
    if (!header) return ''
    const raw = row[header]
    if (raw === undefined || raw === null) return ''
    return String(raw).replace(/\s+/g, ' ').trim()
  }
}
