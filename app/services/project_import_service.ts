import path from 'node:path'
import * as fs from 'node:fs'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import ProjectHeaderResolver from '#services/imports/project_header_resolver'
import ProjectRowMapper, { type NormalizedProjectRow, type ProjectMemberRole } from '#services/imports/project_row_mapper'

type MemberType = 'USER' | 'STUDENT' | 'LECTURER' | 'EXTERNAL'

interface ImportOptions {
  file: string
  sheet?: string
  dryRun?: boolean
  createMissingUsers?: boolean
  verbose?: boolean
  /**
   * true: GVHD/leader_name chỉ map bảng staffs; thành viên chỉ map students (không gắn users).
   * Dùng cho import sheet SV NCKH → projects (STUDENT_RESEARCH).
   */
  studentResearchMode?: boolean
}

interface UserLite {
  id: number
  fullName: string | null
  email: string | null
}

interface StudentLite {
  id: number
  studentCode: string | null
  fullName: string | null
  personalEmail: string | null
  schoolEmail: string | null
}

interface StaffLite {
  id: number
  staffCode: string | null
  fullName: string | null
  email: string | null
}

interface DepartmentLite {
  id: number
  normName: string
  /** Chuẩn hoá departments.code để map donvi_ma */
  normCode: string
}

export interface ProjectImportSummary {
  totalRowsRead: number
  normalizedRowsProcessed: number
  createdProjects: number
  updatedProjects: number
  attachedInternalUsers: number
  /** Thành viên đã khớp bảng students (có student_id nếu cột tồn tại) */
  attachedStudents: number
  /** Người hướng dẫn / cán bộ khớp bảng staffs */
  attachedStaffMembers: number
  attachedRawMembers: number
  matchedLeaders: number
  unmatchedUsers: number
  skippedRows: number
  warnings: string[]
  errors: string[]
}

function normalizeText(v: string): string {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bỏ hậu tố kiểu "(14 đề tài)" trên cột donvi_name để khớp departments.name */
function sanitizeDepartmentLabel(raw: string): string {
  let s = String(raw || '').trim()
  if (!s) return ''
  s = s.replace(/\s*\(\s*\d+\s*đề\s*tài\s*\)\s*$/iu, '')
  s = s.replace(/\s*\(\s*\d+\s*de\s*tai\s*\)\s*$/iu, '')
  return s.trim()
}

/** Bỏ tiền tố học hàm (PGS.TS., TS., …) để khớp staffs.full_name trong DB */
function stripVietnameseAcademicPersonPrefix(raw: string): string {
  let s = String(raw || '').trim()
  if (!s) return ''
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(/^(PGS\.?\s*TS\.?|GS\.?\s*TS\.?|PGS\.?|GS\.?|TS\.?|ThS\.?|Th\.?\s*S\.?|CN\.?)\s*/iu, '')
      .trim()
    if (next === s) break
    s = next
  }
  return s
}

function parseDate(v: string): string | null {
  const s = String(v || '').trim()
  if (!s) return null
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    if (!Number.isNaN(serial) && serial > 20000 && serial < 70000) {
      const utc = Math.round((serial - 25569) * 86400 * 1000)
      const d = new Date(utc)
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth() + 1
      const dd = d.getUTCDate()
      if (y >= 1900 && y <= 2100) return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
    return null
  }
  const normalized = s.replace(/-/g, '/')
  const parts = normalized.split('/')
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year) && year > 1900 && year < 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  if (y < 1900 || y > 2100) return null
  return d.toISOString().slice(0, 10)
}

function parseNumber(v: string): number | null {
  const s = String(v || '').trim().replace(/,/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function splitPotentialNames(raw: string): string[] {
  const text = String(raw || '').trim()
  if (!text) return []
  return text
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean)
}

export default class ProjectImportService {
  static async import(options: ImportOptions): Promise<ProjectImportSummary> {
    const summary: ProjectImportSummary = {
      totalRowsRead: 0,
      normalizedRowsProcessed: 0,
      createdProjects: 0,
      updatedProjects: 0,
      attachedInternalUsers: 0,
      attachedStudents: 0,
      attachedStaffMembers: 0,
      attachedRawMembers: 0,
      matchedLeaders: 0,
      unmatchedUsers: 0,
      skippedRows: 0,
      warnings: [],
      errors: [],
    }

    const filePath = path.isAbsolute(options.file) ? options.file : path.join(process.cwd(), options.file)
    if (!fs.existsSync(filePath)) {
      summary.errors.push(`File not found: ${filePath}`)
      return summary
    }

    const workbook = XLSX.readFile(filePath, { type: 'file' })
    const isCsv = path.extname(filePath).toLowerCase() === '.csv'
    const sheetName = isCsv ? workbook.SheetNames[0] : options.sheet || 'SV_NCKH'
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      summary.errors.push(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`)
      return summary
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    summary.totalRowsRead = rows.length
    if (rows.length === 0) return summary

    const resolver = new ProjectHeaderResolver(Object.keys(rows[0] || {}))
    const normalizedRows: NormalizedProjectRow[] = []
    let ctx = ProjectRowMapper.emptyContext()
    for (let i = 0; i < rows.length; i++) {
      const { nextContext, normalized } = ProjectRowMapper.map(rows[i], i + 2, resolver, ctx, {
        groupByDetaiName: options.studentResearchMode ?? false,
      })
      ctx = nextContext
      if (!normalized) {
        summary.skippedRows++
        continue
      }
      if (!normalized.projectTitle) {
        summary.skippedRows++
        summary.warnings.push(`[row ${normalized.rowNumber}] missing project title`)
        continue
      }
      normalizedRows.push(normalized)
    }
    summary.normalizedRowsProcessed = normalizedRows.length

    const users = await this.loadUsers()
    const userByName = new Map<string, UserLite[]>()
    const userByEmail = new Map<string, UserLite[]>()
    for (const u of users) {
      if (u.fullName) {
        const key = normalizeText(u.fullName)
        const list = userByName.get(key) ?? []
        list.push(u)
        userByName.set(key, list)
      }
      if (u.email) {
        const key = normalizeText(u.email)
        const list = userByEmail.get(key) ?? []
        list.push(u)
        userByEmail.set(key, list)
      }
    }

    const staffCodeMap = await this.loadUserByStaffCode()
    const hasResearchFieldColumn = await this.tableHasColumn('projects', 'research_startup_field_id')
    const hasProjectTypeColumn = await this.tableHasColumn('projects', 'project_type')
    const researchFieldMap = await this.loadResearchFieldMap()
    const students = await this.loadStudents()
    const studentByName = new Map<string, StudentLite[]>()
    const studentByEmail = new Map<string, StudentLite[]>()
    const studentByCode = new Map<string, StudentLite[]>()
    for (const st of students) {
      if (st.fullName) {
        const key = normalizeText(st.fullName)
        const list = studentByName.get(key) ?? []
        list.push(st)
        studentByName.set(key, list)
      }
      for (const em of [st.personalEmail, st.schoolEmail]) {
        if (!em) continue
        const key = normalizeText(em)
        const list = studentByEmail.get(key) ?? []
        list.push(st)
        studentByEmail.set(key, list)
      }
      if (st.studentCode) {
        const key = normalizeText(st.studentCode)
        const list = studentByCode.get(key) ?? []
        list.push(st)
        studentByCode.set(key, list)
      }
    }
    const departments = await this.loadDepartments()
    const projectCache = new Map<string, { id: number; code: string }>()

    const studentResearchMode = options.studentResearchMode ?? false
    const [hasStudentIdCol, hasStaffIdCol, hasLeaderStaffCol] = await Promise.all([
      this.tableHasColumn('project_members', 'student_id'),
      this.tableHasColumn('project_members', 'staff_id'),
      this.tableHasColumn('projects', 'leader_staff_id'),
    ])

    const staffByName = new Map<string, StaffLite[]>()
    const staffByEmail = new Map<string, StaffLite[]>()
    const staffByCode = new Map<string, StaffLite[]>()
    /** Toàn bộ dòng staffs — dùng khớp tên GVHD gần đúng */
    const staffListForFuzzy: StaffLite[] = []
    let staffsLoaded = false
    if (studentResearchMode && (await this.tableExists('staffs'))) {
      staffsLoaded = true
      const loadedStaffs = await this.loadStaffs()
      staffListForFuzzy.push(...loadedStaffs)
      for (const st of loadedStaffs) {
        if (st.fullName) {
          const key = normalizeText(st.fullName)
          const list = staffByName.get(key) ?? []
          list.push(st)
          staffByName.set(key, list)
        }
        if (st.email) {
          const key = normalizeText(st.email)
          const list = staffByEmail.get(key) ?? []
          list.push(st)
          staffByEmail.set(key, list)
        }
        if (st.staffCode) {
          const key = normalizeText(st.staffCode)
          const list = staffByCode.get(key) ?? []
          list.push(st)
          staffByCode.set(key, list)
        }
      }
    } else if (studentResearchMode) {
      summary.warnings.push(
        '[import] studentResearchMode: chưa có bảng staffs — không map người hướng dẫn từ danh mục nhân sự'
      )
    }

    for (const row of normalizedRows) {
      try {
        await db.transaction(async (trx) => {
          const departmentId = this.resolveDepartmentIdForRow(row, departments)
          const researchFieldId = this.resolveResearchFieldId(row.fieldName, researchFieldMap)
          if (row.departmentCode?.trim() && !departmentId) {
            summary.warnings.push(
              `[row ${row.rowNumber}] không map được mã đơn vị (donvi_ma → departments.code): ${row.departmentCode}`
            )
          }
          if (
            !row.departmentCode?.trim() &&
            sanitizeDepartmentLabel(row.departmentName) &&
            !departmentId
          ) {
            summary.warnings.push(`[row ${row.rowNumber}] unmatched department (tên): ${row.departmentName}`)
          }
          if (row.fieldName && !researchFieldId) {
            summary.warnings.push(`[row ${row.rowNumber}] unmatched research field: ${row.fieldName}`)
          }

          const project = await this.findOrCreateProject({
            row,
            trx,
            dryRun: !!options.dryRun,
            projectCache,
            summary,
            departmentId,
            researchFieldId,
            hasResearchFieldColumn,
            hasProjectTypeColumn,
            studentResearchMode,
          })

          if (!project) return

          // Chế độ SV NCKH: "người hướng dẫn" (leader_name trên sheet) map bảng staffs, không dùng users
          if (studentResearchMode && staffsLoaded) {
            const supervisorNames = row.leaderName
              ? splitPotentialNames(row.leaderName)
              : []
            if (supervisorNames.length === 0 && row.leaderName?.trim()) {
              supervisorNames.push(row.leaderName.trim())
            }
            let firstLeaderStaffId: number | null = null
            for (const supName of supervisorNames) {
              const sm = this.findStaffMatch({
                staffCode: '',
                email: '',
                name: supName,
                staffsByCode: staffByCode,
                staffsByEmail: staffByEmail,
                staffsByName: staffByName,
                staffsAllForFuzzy: staffListForFuzzy,
              })
              if (sm.kind === 'one') {
                summary.matchedLeaders++
                if (firstLeaderStaffId === null) firstLeaderStaffId = sm.staff.id
                await this.attachStaffMember({
                  trx,
                  projectId: project.id,
                  staff: sm.staff,
                  rawName: supName,
                  role: 'SUPERVISOR',
                  isMain: false,
                  summary,
                  dryRun: !!options.dryRun,
                  hasStaffIdCol,
                })
              } else if (sm.kind === 'many') {
                summary.warnings.push(`[row ${row.rowNumber}] trùng nhiều nhân sự (staffs) cho GVHD: ${supName}`)
              } else if (supName.trim()) {
                summary.unmatchedUsers++
                summary.warnings.push(
                  `[row ${row.rowNumber}] không tìm thấy người hướng dẫn trong staffs: ${supName}`
                )
              }
            }
            if (
              firstLeaderStaffId !== null &&
              hasLeaderStaffCol &&
              !options.dryRun
            ) {
              await trx
                .from('projects')
                .where('id', project.id)
                .update({ leader_staff_id: firstLeaderStaffId, updated_at: new Date() })
            }
          } else if (!studentResearchMode) {
            const leaderMatch = await this.findUser({
              memberCode: '',
              email: '',
              name: row.leaderName,
              usersByEmail: userByEmail,
              usersByName: userByName,
              usersByStaffCode: staffCodeMap,
              studentsByCode: studentByCode,
              studentsByEmail: studentByEmail,
              studentsByName: studentByName,
            })

            if (leaderMatch.kind === 'one' && leaderMatch.source === 'USER') {
              summary.matchedLeaders++
              await this.attachInternalMember({
                trx,
                projectId: project.id,
                userId: leaderMatch.user.id,
                rawName: row.leaderName,
                memberCode: '',
                email: '',
                role: 'LEADER',
                isMain: true,
                summary,
                dryRun: !!options.dryRun,
              })
              if (!options.dryRun) {
                await trx
                  .from('projects')
                  .where('id', project.id)
                  .update({ leader_user_id: leaderMatch.user.id, updated_at: new Date() })
              }
            } else if (leaderMatch.kind === 'one' && leaderMatch.source === 'STUDENT') {
              summary.warnings.push(
                `[row ${row.rowNumber}] leader matched student, skipped leader_user_id: ${row.leaderName}`
              )
            } else if (row.leaderName && leaderMatch.kind !== 'none') {
              summary.warnings.push(`[row ${row.rowNumber}] ambiguous leader: ${row.leaderName}`)
            } else if (row.leaderName && leaderMatch.kind === 'none') {
              summary.unmatchedUsers++
              summary.warnings.push(`[row ${row.rowNumber}] leader not matched: ${row.leaderName}`)
            }
          }

          const participantNames = splitPotentialNames(row.memberName)
          if (participantNames.length === 0 && (row.memberCode || row.email)) {
            participantNames.push(row.memberName || row.email || row.memberCode)
          }

          for (const name of participantNames) {
            if (studentResearchMode) {
              const stMatch = this.findStudentMatch({
                memberCode: row.memberCode,
                email: row.email,
                name,
                studentsByCode: studentByCode,
                studentsByEmail: studentByEmail,
                studentsByName: studentByName,
              })
              if (stMatch.kind === 'one') {
                await this.attachMatchedStudentMember({
                  trx,
                  projectId: project.id,
                  student: stMatch.student,
                  rawName: name,
                  memberCode: row.memberCode,
                  email: row.email,
                  role: row.role,
                  summary,
                  dryRun: !!options.dryRun,
                  hasStudentIdCol,
                })
              } else {
                if (stMatch.kind === 'many') {
                  summary.warnings.push(`[row ${row.rowNumber}] trùng nhiều sinh viên: ${name}`)
                } else {
                  summary.unmatchedUsers++
                  summary.warnings.push(
                    `[row ${row.rowNumber}] không khớp sinh viên trong bảng students: ${name}`
                  )
                }
                await this.attachRawMember({
                  trx,
                  projectId: project.id,
                  rawName: name,
                  memberCode: row.memberCode,
                  email: row.email,
                  role: row.role,
                  summary,
                  dryRun: !!options.dryRun,
                })
              }
            } else {
              const matched = await this.findUser({
                memberCode: row.memberCode,
                email: row.email,
                name,
                usersByEmail: userByEmail,
                usersByName: userByName,
                usersByStaffCode: staffCodeMap,
                studentsByCode: studentByCode,
                studentsByEmail: studentByEmail,
                studentsByName: studentByName,
              })

              if (matched.kind === 'one' && matched.source === 'USER') {
                await this.attachInternalMember({
                  trx,
                  projectId: project.id,
                  userId: matched.user.id,
                  rawName: name,
                  memberCode: row.memberCode,
                  email: row.email,
                  role: row.role,
                  isMain: row.role === 'LEADER',
                  summary,
                  dryRun: !!options.dryRun,
                })
              } else if (matched.kind === 'one' && matched.source === 'STUDENT') {
                await this.attachMatchedStudentMember({
                  trx,
                  projectId: project.id,
                  student: matched.student,
                  rawName: name,
                  memberCode: row.memberCode,
                  email: row.email,
                  role: row.role,
                  summary,
                  dryRun: !!options.dryRun,
                  hasStudentIdCol,
                })
              } else {
                if (matched.kind === 'many') {
                  summary.warnings.push(`[row ${row.rowNumber}] ambiguous user: ${name}`)
                } else {
                  summary.unmatchedUsers++
                  summary.warnings.push(`[row ${row.rowNumber}] user not matched: ${name}`)
                }
                await this.attachRawMember({
                  trx,
                  projectId: project.id,
                  rawName: name,
                  memberCode: row.memberCode,
                  email: row.email,
                  role: row.role,
                  summary,
                  dryRun: !!options.dryRun,
                })
              }
            }
          }
        })
      } catch (error) {
        summary.errors.push(`[row ${row.rowNumber}] ${(error as Error).message}`)
      }
    }

    return summary
  }

  private static async loadUsers(): Promise<UserLite[]> {
    const rows = await db.from('users').select('id', 'full_name', 'email')
    return rows.map((r) => ({
      id: Number(r.id),
      fullName: r.full_name ? String(r.full_name) : null,
      email: r.email ? String(r.email) : null,
    }))
  }

  private static async loadStudents(): Promise<StudentLite[]> {
    const rows = await db
      .from('students')
      .select('id', 'student_code', 'full_name', 'personal_email', 'school_email')
    return rows.map((r) => ({
      id: Number(r.id),
      studentCode: r.student_code ? String(r.student_code) : null,
      fullName: r.full_name ? String(r.full_name) : null,
      personalEmail: r.personal_email ? String(r.personal_email) : null,
      schoolEmail: r.school_email ? String(r.school_email) : null,
    }))
  }

  /** Danh mục nhân sự (DMNHanSu → staffs) để map người hướng dẫn */
  private static async loadStaffs(): Promise<StaffLite[]> {
    const rows = await db.from('staffs').select('id', 'staff_code', 'full_name', 'email')
    return rows.map((r) => ({
      id: Number(r.id),
      staffCode: r.staff_code ? String(r.staff_code) : null,
      fullName: r.full_name ? String(r.full_name) : null,
      email: r.email ? String(r.email) : null,
    }))
  }

  private static async loadUserByStaffCode(): Promise<Map<string, UserLite[]>> {
    const map = new Map<string, UserLite[]>()
    const hasPersonalProfiles = await this.tableExists('personal_profiles')
    if (!hasPersonalProfiles) return map

    const rows = await db
      .from('personal_profiles')
      .join('users', 'users.id', 'personal_profiles.user_id')
      .select('users.id as id', 'users.full_name as full_name', 'users.email as email', 'personal_profiles.staff_code as staff_code')
      .whereNotNull('personal_profiles.staff_code')
    for (const r of rows) {
      const key = normalizeText(String(r.staff_code || ''))
      if (!key) continue
      const list = map.get(key) ?? []
      list.push({
        id: Number(r.id),
        fullName: r.full_name ? String(r.full_name) : null,
        email: r.email ? String(r.email) : null,
      })
      map.set(key, list)
    }
    return map
  }

  private static async loadDepartments(): Promise<DepartmentLite[]> {
    const list: DepartmentLite[] = []
    const rows = await db.from('departments').select('id', 'name', 'code')
    for (const r of rows) {
      const n = normalizeText(String(r.name || ''))
      const c = normalizeText(String(r.code || ''))
      if (!n && !c) continue
      list.push({
        id: Number(r.id),
        normName: n,
        normCode: c,
      })
    }
    return list
  }

  /** Ưu tiên donvi_ma → code; không được thì tên đơn vị (đã làm sạch hậu tố Excel) */
  private static resolveDepartmentIdForRow(
    row: NormalizedProjectRow,
    departments: DepartmentLite[]
  ): number | null {
    const codeRaw = String(row.departmentCode || '').trim()
    if (codeRaw) {
      const byCode = this.resolveDepartmentIdByCode(codeRaw, departments)
      if (byCode !== null) return byCode
    }
    const namePart = sanitizeDepartmentLabel(row.departmentName)
    return this.resolveDepartmentId(namePart, departments)
  }

  private static resolveDepartmentIdByCode(code: string, departments: DepartmentLite[]): number | null {
    const target = normalizeText(String(code).trim())
    if (!target) return null
    for (const d of departments) {
      if (d.normCode && d.normCode === target) return d.id
    }
    return null
  }

  private static resolveDepartmentId(name: string, departments: DepartmentLite[]): number | null {
    const target = normalizeText(name || '')
    if (!target) return null

    // 1) Exact match
    for (const d of departments) {
      if (d.normName === target) return d.id
    }

    // 2) Fuzzy: substring + token overlap
    const targetTokens = new Set(target.split(' ').filter(Boolean))
    let bestId: number | null = null
    let bestScore = 0

    for (const d of departments) {
      let score = 0
      if (target.includes(d.normName) || d.normName.includes(target)) {
        const lenRatio = Math.min(target.length, d.normName.length) / Math.max(target.length, d.normName.length)
        score = 0.7 + 0.3 * lenRatio
      } else {
        const depTokens = new Set(d.normName.split(' ').filter(Boolean))
        let inter = 0
        for (const t of targetTokens) {
          if (depTokens.has(t)) inter++
        }
        const union = targetTokens.size + depTokens.size - inter
        if (union > 0) score = inter / union
      }

      if (score > bestScore) {
        bestScore = score
        bestId = d.id
      }
    }

    // threshold vừa phải để tránh map bừa
    return bestScore >= 0.45 ? bestId : null
  }

  private static async loadResearchFieldMap(): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    const rows = await db
      .from('research_startup_fields')
      .select('id', 'name')
      .where('type', 'RESEARCH')
      .where('is_active', true)
    for (const r of rows) {
      const n = normalizeText(String(r.name || ''))
      if (!n) continue
      map.set(n, Number(r.id))
    }
    return map
  }

  private static resolveResearchFieldId(fieldName: string, map: Map<string, number>): number | null {
    const normalized = normalizeText(fieldName || '')
    if (!normalized) return null

    const candidates = [...map.entries()].map(([name, id]) => ({ id, normName: name }))

    const exact = map.get(normalized)
    if (exact) return exact

    const tokens = normalized
      .split(/[,;/|]+/g)
      .map((t) => t.trim())
      .filter(Boolean)
    for (const token of tokens) {
      const hit = map.get(token)
      if (hit) return hit
    }

    const targetTokens = new Set(
      normalized
        .split(/[\s,;/|]+/g)
        .map((t) => t.trim())
        .filter(Boolean)
    )
    let bestId: number | null = null
    let bestScore = 0

    for (const c of candidates) {
      let score = 0
      if (normalized.includes(c.normName) || c.normName.includes(normalized)) {
        const lenRatio = Math.min(normalized.length, c.normName.length) / Math.max(normalized.length, c.normName.length)
        score = 0.7 + 0.3 * lenRatio
      } else {
        const candidateTokens = new Set(
          c.normName
            .split(/[\s,;/|]+/g)
            .map((t) => t.trim())
            .filter(Boolean)
        )
        let inter = 0
        for (const t of targetTokens) {
          if (candidateTokens.has(t)) inter++
        }
        const union = targetTokens.size + candidateTokens.size - inter
        if (union > 0) score = inter / union
      }

      if (score > bestScore) {
        bestScore = score
        bestId = c.id
      }
    }

    return bestScore >= 0.4 ? bestId : null
  }

  private static async findOrCreateProject(args: {
    row: NormalizedProjectRow
    trx: any
    dryRun: boolean
    projectCache: Map<string, { id: number; code: string }>
    summary: ProjectImportSummary
    departmentId: number | null
    researchFieldId: number | null
    hasResearchFieldColumn: boolean
    hasProjectTypeColumn: boolean
    /** Mỗi dòng là thành viên: gom đề theo khóa tổ hợp (Detai + năm + đơn vị), không tách nhầm vì donvi_ma từng dòng */
    studentResearchMode: boolean
  }): Promise<{ id: number; code: string } | null> {
    const {
      row,
      trx,
      dryRun,
      projectCache,
      summary,
      departmentId,
      researchFieldId,
      hasResearchFieldColumn,
      hasProjectTypeColumn,
      studentResearchMode,
    } = args
    // SV NCKH: cache theo khóa tổ hợp (Detai + năm + nhãn đơn vị) — Detai_name trùng trên nhiều dòng thành viên cùng một khóa.
    const cacheKey = studentResearchMode
      ? `${normalizeText(row.projectCode)}|${
          row.studentResearchIdentityKey ??
          `${normalizeText(row.projectTitle)}|${normalizeText(row.academicYear)}|${normalizeText(row.year)}`
        }`
      : `${normalizeText(row.projectCode)}|${normalizeText(row.projectTitle)}|${normalizeText(row.academicYear)}|${normalizeText(row.departmentCode)}|${normalizeText(row.departmentName)}|${normalizeText(row.year)}`
    const cached = projectCache.get(cacheKey)
    if (cached) return cached

    let found = null as any
    if (row.projectCode) {
      found = await trx.from('projects').where('code', row.projectCode).first()
    }

    const yearNum = parseInt(row.year || '0', 10) || null
    const normTitle = normalizeText(row.projectTitle)

    if (!found && studentResearchMode) {
      const applyType = (q: any) => {
        if (hasProjectTypeColumn) return q.where('project_type', 'STUDENT_RESEARCH')
        return q
      }
      if (yearNum) {
        let q = trx.from('projects').where('year', yearNum)
        q = applyType(q)
        const candidates = await q
        found =
          candidates.find(
            (p: { title?: string }) => normalizeText(String(p.title ?? '')) === normTitle
          ) ?? null
      }
      if (!found && row.academicYear?.trim()) {
        let q = trx
          .from('projects')
          .whereRaw('LOWER(COALESCE(academic_year, \'\')) = ?', [row.academicYear.toLowerCase()])
        q = applyType(q)
        const candidates = await q
        found =
          candidates.find(
            (p: { title?: string }) => normalizeText(String(p.title ?? '')) === normTitle
          ) ?? null
      }
    }

    if (!found && !studentResearchMode) {
      // Ưu tiên match theo year nếu có để tránh dồn nhầm năm khi academic_year trống.
      if (yearNum) {
        const q = trx
          .from('projects')
          .whereRaw('LOWER(title) = ?', [row.projectTitle.toLowerCase()])
          .where('year', yearNum)
        if (departmentId) q.where('department_id', departmentId)
        found = await q.first()
      }
    }
    if (!found && !studentResearchMode) {
      const q = trx
        .from('projects')
        .whereRaw('LOWER(title) = ?', [row.projectTitle.toLowerCase()])
        .whereRaw('LOWER(COALESCE(academic_year, \'\')) = ?', [row.academicYear.toLowerCase()])
      if (departmentId) q.where('department_id', departmentId)
      found = await q.first()
    }

    if (!found) {
      const code = row.projectCode || (await this.generateProjectCode(trx))
      const payload = {
        code,
        title: row.projectTitle,
        field: row.fieldName || null,
        level: row.level || null,
        academic_year: row.academicYear || null,
        year: parseInt(row.year || '0', 10) || null,
        department_id: departmentId,
        leader_name: row.leaderName || null,
        leader_unit: row.leaderUnit || null,
        objectives: row.objectives || null,
        summary: row.summary || null,
        expected_results: row.expectedResults || null,
        budget_total: parseNumber(row.budgetTotal),
        start_date: parseDate(row.startDate),
        end_date: parseDate(row.endDate),
        status: row.status,
        note: row.note || null,
        created_at: new Date(),
        updated_at: new Date(),
      } as Record<string, unknown>
      if (hasResearchFieldColumn) {
        payload.research_startup_field_id = researchFieldId
      }
      if (hasProjectTypeColumn) {
        payload.project_type = 'STUDENT_RESEARCH'
      }
      if (!dryRun) {
        const inserted = await trx.table('projects').insert(payload).returning(['id', 'code'])
        found = Array.isArray(inserted) ? inserted[0] : inserted
      } else {
        found = { id: -Date.now(), code }
      }
      summary.createdProjects++
    } else {
      const updates: Record<string, unknown> = {}
      const setIfMissing = (key: string, value: unknown) => {
        if ((found[key] === null || found[key] === '' || found[key] === undefined) && value !== null && value !== '') {
          updates[key] = value
        }
      }
      setIfMissing('field', row.fieldName || null)
      setIfMissing('level', row.level || null)
      setIfMissing('academic_year', row.academicYear || null)
      setIfMissing('year', parseInt(row.year || '0', 10) || null)
      setIfMissing('department_id', departmentId)
      setIfMissing('leader_name', row.leaderName || null)
      setIfMissing('leader_unit', row.leaderUnit || null)
      setIfMissing('objectives', row.objectives || null)
      setIfMissing('summary', row.summary || null)
      setIfMissing('expected_results', row.expectedResults || null)
      setIfMissing('budget_total', parseNumber(row.budgetTotal))
      setIfMissing('start_date', parseDate(row.startDate))
      setIfMissing('end_date', parseDate(row.endDate))
      setIfMissing('note', row.note || null)
      if (hasResearchFieldColumn) {
        setIfMissing('research_startup_field_id', researchFieldId)
      }
      if (hasProjectTypeColumn) {
        setIfMissing('project_type', 'STUDENT_RESEARCH')
      }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date()
        if (!dryRun) {
          await trx.from('projects').where('id', found.id).update(updates)
        }
        summary.updatedProjects++
      }
    }

    const project = { id: Number(found.id), code: String(found.code) }
    projectCache.set(cacheKey, project)
    return project
  }

  /** Chỉ khớp sinh viên (dùng cho studentResearchMode — không thử users) */
  private static findStudentMatch(args: {
    memberCode: string
    email: string
    name: string
    studentsByCode: Map<string, StudentLite[]>
    studentsByEmail: Map<string, StudentLite[]>
    studentsByName: Map<string, StudentLite[]>
  }): { kind: 'none' } | { kind: 'one'; student: StudentLite } | { kind: 'many' } {
    const code = normalizeText(args.memberCode || '')
    if (code) {
      const byC = args.studentsByCode.get(code) ?? []
      if (byC.length === 1) return { kind: 'one', student: byC[0] }
      if (byC.length > 1) return { kind: 'many' }
    }

    const email = normalizeText(args.email || '')
    if (email) {
      const byE = args.studentsByEmail.get(email) ?? []
      if (byE.length === 1) return { kind: 'one', student: byE[0] }
      if (byE.length > 1) return { kind: 'many' }
    }

    const name = normalizeText(args.name || '')
    if (name) {
      const byN = args.studentsByName.get(name) ?? []
      if (byN.length === 1) return { kind: 'one', student: byN[0] }
      if (byN.length > 1) return { kind: 'many' }
    }

    return { kind: 'none' }
  }

  /** Điểm khớp họ tên (chuỗi đã normalize): trùng chuỗi con hoặc trùng từ (Jaccard) */
  private static scoreStaffNameSimilarity(a: string, b: string): number {
    if (!a || !b) return 0
    if (a === b) return 1
    if (a.includes(b) || b.includes(a)) {
      const lenRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length)
      return 0.72 + 0.28 * lenRatio
    }
    const ta = new Set(a.split(' ').filter(Boolean))
    const tb = new Set(b.split(' ').filter(Boolean))
    let inter = 0
    for (const t of ta) {
      if (tb.has(t)) inter++
    }
    const union = ta.size + tb.size - inter
    return union > 0 ? inter / union : 0
  }

  /**
   * Khớp cán bộ staffs: mã/email/tên trùng trước; không có thì khớp tên gần đúng (ngưỡng + tránh trùng sát).
   */
  private static findStaffMatch(args: {
    staffCode: string
    email: string
    name: string
    staffsByCode: Map<string, StaffLite[]>
    staffsByEmail: Map<string, StaffLite[]>
    staffsByName: Map<string, StaffLite[]>
    staffsAllForFuzzy: StaffLite[]
  }): { kind: 'none' } | { kind: 'one'; staff: StaffLite } | { kind: 'many' } {
    const code = normalizeText(args.staffCode || '')
    if (code) {
      const byC = args.staffsByCode.get(code) ?? []
      if (byC.length === 1) return { kind: 'one', staff: byC[0] }
      if (byC.length > 1) return { kind: 'many' }
    }

    const email = normalizeText(args.email || '')
    if (email) {
      const byE = args.staffsByEmail.get(email) ?? []
      if (byE.length === 1) return { kind: 'one', staff: byE[0] }
      if (byE.length > 1) return { kind: 'many' }
    }

    const nameKeys = new Set<string>()
    const n1 = normalizeText(args.name || '')
    const n2 = normalizeText(stripVietnameseAcademicPersonPrefix(args.name || ''))
    if (n1) nameKeys.add(n1)
    if (n2) nameKeys.add(n2)
    for (const nk of nameKeys) {
      const byN = args.staffsByName.get(nk) ?? []
      if (byN.length === 1) return { kind: 'one', staff: byN[0] }
      if (byN.length > 1) return { kind: 'many' }
    }

    // Khớp gần đúng theo họ tên (sheet GVHD thường lệch dấu / thừa từ so với DM nhân sự)
    const fuzzyTarget = n2 || n1
    if (!fuzzyTarget || args.staffsAllForFuzzy.length === 0) return { kind: 'none' }

    let bestStaff: StaffLite | null = null
    let bestScore = 0
    let secondScore = 0
    for (const st of args.staffsAllForFuzzy) {
      const sn = normalizeText(st.fullName || '')
      if (!sn) continue
      const sc = this.scoreStaffNameSimilarity(fuzzyTarget, sn)
      if (sc > bestScore) {
        secondScore = bestScore
        bestScore = sc
        bestStaff = st
      } else if (sc > secondScore) {
        secondScore = sc
      }
    }

    const minScore = 0.4
    if (!bestStaff || bestScore < minScore) return { kind: 'none' }
    if (secondScore >= minScore && bestScore - secondScore < 0.06) return { kind: 'many' }

    return { kind: 'one', staff: bestStaff }
  }

  private static async findUser(args: {
    memberCode: string
    email: string
    name: string
    usersByEmail: Map<string, UserLite[]>
    usersByName: Map<string, UserLite[]>
    usersByStaffCode: Map<string, UserLite[]>
    studentsByCode: Map<string, StudentLite[]>
    studentsByEmail: Map<string, StudentLite[]>
    studentsByName: Map<string, StudentLite[]>
  }): Promise<
    | { kind: 'none' }
    | { kind: 'one'; source: 'USER'; user: UserLite }
    | { kind: 'one'; source: 'STUDENT'; student: StudentLite }
    | { kind: 'many' }
  > {
    const code = normalizeText(args.memberCode || '')
    if (code) {
      const studentsByCode = args.studentsByCode.get(code) ?? []
      if (studentsByCode.length === 1) return { kind: 'one', source: 'STUDENT', student: studentsByCode[0] }
      if (studentsByCode.length > 1) return { kind: 'many' }
    }

    if (code) {
      const byCode = args.usersByStaffCode.get(code) ?? []
      if (byCode.length === 1) return { kind: 'one', source: 'USER', user: byCode[0] }
      if (byCode.length > 1) return { kind: 'many' }
    }

    const email = normalizeText(args.email || '')
    if (email) {
      const studentsByEmail = args.studentsByEmail.get(email) ?? []
      if (studentsByEmail.length === 1) return { kind: 'one', source: 'STUDENT', student: studentsByEmail[0] }
      if (studentsByEmail.length > 1) return { kind: 'many' }
    }

    if (email) {
      const byEmail = args.usersByEmail.get(email) ?? []
      if (byEmail.length === 1) return { kind: 'one', source: 'USER', user: byEmail[0] }
      if (byEmail.length > 1) return { kind: 'many' }
    }

    const name = normalizeText(args.name || '')
    if (name) {
      const studentsByName = args.studentsByName.get(name) ?? []
      if (studentsByName.length === 1) return { kind: 'one', source: 'STUDENT', student: studentsByName[0] }
      if (studentsByName.length > 1) return { kind: 'many' }
    }

    if (name) {
      const byName = args.usersByName.get(name) ?? []
      if (byName.length === 1) return { kind: 'one', source: 'USER', user: byName[0] }
      if (byName.length > 1) return { kind: 'many' }
    }

    return { kind: 'none' }
  }

  private static async attachStaffMember(args: {
    trx: any
    projectId: number
    staff: StaffLite
    rawName: string
    role: ProjectMemberRole
    isMain: boolean
    summary: ProjectImportSummary
    dryRun: boolean
    hasStaffIdCol: boolean
  }): Promise<void> {
    let exists = null as any
    if (args.hasStaffIdCol) {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('staff_id', args.staff.id)
        .first()
    } else {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('member_type', 'LECTURER')
        .whereRaw('LOWER(TRIM(member_name)) = ?', [String(args.rawName || args.staff.fullName || '').toLowerCase().trim()])
        .first()
    }
    if (exists) return

    const row: Record<string, unknown> = {
      project_id: args.projectId,
      member_type: 'LECTURER' as MemberType,
      user_id: null,
      member_name: args.rawName || args.staff.fullName || null,
      member_code: args.staff.staffCode || null,
      email: args.staff.email || null,
      role: args.role,
      is_main: args.isMain,
      unit: null,
      joined_at: null,
      note: `MATCHED_STAFF_ID:${args.staff.id}`,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (args.hasStaffIdCol) row.staff_id = args.staff.id

    if (!args.dryRun) {
      await args.trx.table('project_members').insert(row)
    }
    args.summary.attachedStaffMembers++
  }

  private static async attachInternalMember(args: {
    trx: any
    projectId: number
    userId: number
    rawName: string
    memberCode: string
    email: string
    role: ProjectMemberRole
    isMain: boolean
    summary: ProjectImportSummary
    dryRun: boolean
  }): Promise<void> {
    const exists = await args.trx
      .from('project_members')
      .where('project_id', args.projectId)
      .where('user_id', args.userId)
      .first()
    if (exists) return
    const row = {
      project_id: args.projectId,
      member_type: 'USER' as MemberType,
      user_id: args.userId,
      member_name: args.rawName || null,
      member_code: args.memberCode || null,
      email: args.email || null,
      role: args.role,
      is_main: args.isMain,
      unit: null,
      joined_at: null,
      note: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (!args.dryRun) {
      await args.trx.table('project_members').insert(row)
    }
    args.summary.attachedInternalUsers++
  }

  private static async attachMatchedStudentMember(args: {
    trx: any
    projectId: number
    student: StudentLite
    rawName: string
    memberCode: string
    email: string
    role: ProjectMemberRole
    summary: ProjectImportSummary
    dryRun: boolean
    hasStudentIdCol?: boolean
  }): Promise<void> {
    const hasStudentIdCol = args.hasStudentIdCol ?? false
    const effectiveCode = args.student.studentCode || args.memberCode || null
    let exists = null as any
    if (hasStudentIdCol) {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('student_id', args.student.id)
        .first()
    } else if (effectiveCode) {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('member_code', effectiveCode)
        .first()
    } else {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('member_type', 'STUDENT')
        .where('member_name', args.rawName || args.student.fullName || null)
        .first()
    }
    if (exists) return

    const row: Record<string, unknown> = {
      project_id: args.projectId,
      member_type: 'STUDENT' as MemberType,
      user_id: null,
      member_name: args.rawName || args.student.fullName || null,
      member_code: effectiveCode,
      email: args.email || args.student.schoolEmail || args.student.personalEmail || null,
      role: args.role,
      is_main: args.role === 'LEADER',
      unit: null,
      joined_at: null,
      note: `MATCHED_STUDENT_ID:${args.student.id}`,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (hasStudentIdCol) row.student_id = args.student.id

    if (!args.dryRun) {
      await args.trx.table('project_members').insert(row)
    }
    args.summary.attachedStudents++
  }

  private static async attachRawMember(args: {
    trx: any
    projectId: number
    rawName: string
    memberCode: string
    email: string
    role: ProjectMemberRole
    summary: ProjectImportSummary
    dryRun: boolean
  }): Promise<void> {
    let exists = null as any
    if (args.memberCode) {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('member_code', args.memberCode)
        .first()
    } else if (args.rawName) {
      exists = await args.trx
        .from('project_members')
        .where('project_id', args.projectId)
        .where('member_name', args.rawName)
        .where('email', args.email || null)
        .first()
    }
    if (exists) return

    const memberType: MemberType = args.memberCode ? 'STUDENT' : 'EXTERNAL'
    const row = {
      project_id: args.projectId,
      member_type: memberType,
      user_id: null,
      member_name: args.rawName || null,
      member_code: args.memberCode || null,
      email: args.email || null,
      role: args.role,
      is_main: args.role === 'LEADER',
      unit: null,
      joined_at: null,
      note: 'IMPORTED_RAW_MEMBER',
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (!args.dryRun) {
      await args.trx.table('project_members').insert(row)
    }
    args.summary.attachedRawMembers++
  }

  private static async generateProjectCode(trx: any): Promise<string> {
    const y = new Date().getFullYear()
    const prefix = `NCKH-${y}-`
    const last = await trx.from('projects').whereRaw('code LIKE ?', [`${prefix}%`]).orderBy('id', 'desc').first()
    let seq = 1
    if (last?.code) {
      const n = parseInt(String(last.code).split('-')[2] || '0', 10)
      if (!Number.isNaN(n)) seq = n + 1
    }
    return `${prefix}${String(seq).padStart(4, '0')}`
  }

  private static async tableExists(tableName: string): Promise<boolean> {
    const res = await db.rawQuery(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ?
      ) as ok`,
      [tableName]
    )
    return Boolean(res.rows?.[0]?.ok)
  }

  private static async tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
    const res = await db.rawQuery(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
      ) as ok`,
      [tableName, columnName]
    )
    return Boolean(res.rows?.[0]?.ok)
  }
}
