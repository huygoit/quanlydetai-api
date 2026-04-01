import path from 'node:path'
import * as fs from 'node:fs'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import ProjectResearchHeaderResolver from '#services/imports/project_research_header_resolver'
import ProjectResearchRowMapper, { type NormalizedResearchProjectRow } from '#services/imports/project_research_row_mapper'

interface ImportOptions {
  file: string
  sheet?: string
  dryRun?: boolean
  verbose?: boolean
}

interface UserLite {
  id: number
  fullName: string | null
  email: string | null
}

interface DepartmentLite {
  id: number
  code: string | null
  name: string
}

export interface ResearchProjectImportSummary {
  totalRowsRead: number
  createdProjects: number
  updatedProjects: number
  matchedInternalLeaders: number
  fallbackRawLeadersCreated: number
  unmatchedDepartments: number
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

function parseDate(v: string): string | null {
  const s = String(v || '').trim()
  if (!s) return null

  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    if (!Number.isNaN(serial) && serial > 20000 && serial < 70000) {
      const utc = Math.round((serial - 25569) * 86400 * 1000)
      const d = new Date(utc)
      const y = d.getUTCFullYear()
      if (y >= 1900 && y <= 2100) {
        return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
    return null
  }

  const parts = s.replace(/-/g, '/').split('/')
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const y = parseInt(parts[2], 10)
    if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y) && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear()
    if (y >= 1900 && y <= 2100) return parsed.toISOString().slice(0, 10)
  }
  return null
}

/** Bỏ dấu phẩy, hậu tố tiền tệ (đ, VND) và khoảng trắng — sheet GV_NCKH kiểu "1,150,000,000.00 đ" */
function parseNumber(v: string): number | null {
  let s = String(v || '')
    .replace(/,/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s*đ\s*$/iu, '')
    .replace(/\s*vnd\s*$/iu, '')
    .trim()
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function parseYear(v: string): number | null {
  const n = parseInt(String(v || '').trim(), 10)
  if (Number.isNaN(n) || n < 1900 || n > 2200) return null
  return n
}

function normalizeApprovalStatus(raw: string): string | null {
  const s = normalizeText(raw)
  if (!s) return null
  if (s.includes('da phe duyet') || s.includes('approved')) return 'APPROVED'
  if (s.includes('tu choi') || s.includes('rejected')) return 'REJECTED'
  if (s.includes('cho duyet') || s.includes('pending')) return 'PENDING'
  return raw.trim()
}

function normalizeProjectStatus(raw: string): string {
  const s = normalizeText(raw)
  if (!s) return 'DRAFT'
  if (s.includes('dang thuc hien') || s.includes('in progress')) return 'IN_PROGRESS'
  if (s.includes('hoan thanh') || s.includes('completed')) return 'COMPLETED'
  if (s.includes('huy') || s.includes('cancel')) return 'CANCELLED'
  if (s.includes('duyet') || s.includes('approved')) return 'APPROVED'
  if (s.includes('tu choi') || s.includes('reject')) return 'REJECTED'
  if (s.includes('gui') || s.includes('submitted')) return 'SUBMITTED'
  return raw.trim() || 'DRAFT'
}

function appendExtensionInfoToNote(baseNote: string | null, row: NormalizedResearchProjectRow): string | null {
  const chunks: string[] = []
  if (row.isExtended) chunks.push(`is_giahan=${row.isExtended}`)
  if (row.extendedTime) chunks.push(`thoigian_giahan=${row.extendedTime}`)
  if (row.unitCode) chunks.push(`don_vi_id=${row.unitCode}`)
  if (row.acceptanceYear) chunks.push(`nam_nghiem_thu=${row.acceptanceYear}`)
  if (chunks.length === 0) return baseNote
  return [baseNote || '', chunks.join('; ')].filter(Boolean).join(' | ')
}

export default class ProjectResearchImportService {
  static async import(options: ImportOptions): Promise<ResearchProjectImportSummary> {
    const summary: ResearchProjectImportSummary = {
      totalRowsRead: 0,
      createdProjects: 0,
      updatedProjects: 0,
      matchedInternalLeaders: 0,
      fallbackRawLeadersCreated: 0,
      unmatchedDepartments: 0,
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
    const sheetName = isCsv ? workbook.SheetNames[0] : options.sheet || 'BangNCKH'
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      summary.errors.push(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`)
      return summary
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    summary.totalRowsRead = rows.length
    if (rows.length === 0) return summary

    const resolver = new ProjectResearchHeaderResolver(Object.keys(rows[0] || {}))
    const users = await this.loadUsers()
    const usersByCode = await this.loadUsersByStaffCode()
    const userNameMap = new Map<string, UserLite[]>()
    for (const u of users) {
      if (!u.fullName) continue
      const key = normalizeText(u.fullName)
      const list = userNameMap.get(key) ?? []
      list.push(u)
      userNameMap.set(key, list)
    }

    const departments = await this.loadDepartments()
    const hasProposalId = await this.tableHasColumn('projects', 'proposal_id')
    const hasLeaderUserId = await this.tableHasColumn('projects', 'leader_user_id')
    const hasDepartmentId = await this.tableHasColumn('projects', 'department_id')
    const hasApprovalStatus = await this.tableHasColumn('projects', 'approval_status')
    const hasYear = await this.tableHasColumn('projects', 'year')
    const hasBudgetTotal = await this.tableHasColumn('projects', 'budget_total')
    const hasStartDate = await this.tableHasColumn('projects', 'start_date')
    const hasEndDate = await this.tableHasColumn('projects', 'end_date')
    const hasLeaderUnit = await this.tableHasColumn('projects', 'leader_unit')
    const hasLeaderName = await this.tableHasColumn('projects', 'leader_name')
    const hasStatus = await this.tableHasColumn('projects', 'status')
    const hasNote = await this.tableHasColumn('projects', 'note')
    const hasProjectType = await this.tableHasColumn('projects', 'project_type')

    for (let i = 0; i < rows.length; i++) {
      const normalized = ProjectResearchRowMapper.map(rows[i], i + 2, resolver)
      if (!normalized) {
        summary.skippedRows++
        continue
      }

      try {
        await db.transaction(async (trx) => {
          const departmentId = this.findDepartmentByCodeOrName(normalized.unitCode, normalized.unitName, departments)
          if ((normalized.unitCode || normalized.unitName) && !departmentId) {
            summary.unmatchedDepartments++
            summary.warnings.push(
              `[row ${normalized.rowNumber}] unmatched unit: code=${normalized.unitCode || '-'} name=${normalized.unitName || '-'}`
            )
          }

          const project = await this.findOrCreateProject(
            trx,
            normalized,
            {
              hasProposalId,
              hasLeaderUserId,
              hasDepartmentId,
              hasApprovalStatus,
              hasYear,
              hasBudgetTotal,
              hasStartDate,
              hasEndDate,
              hasLeaderUnit,
              hasLeaderName,
              hasStatus,
              hasNote,
              hasProjectType,
            },
            departmentId,
            !!options.dryRun,
            summary
          )

          if (!project) return

          const leader = this.findUserByCodeOrName(normalized.leaderCode, normalized.leaderName, usersByCode, userNameMap)
          if (leader.kind === 'one') {
            summary.matchedInternalLeaders++
            if (!options.dryRun && hasLeaderUserId) {
              await trx
                .from('projects')
                .where('id', project.id)
                .update({ leader_user_id: leader.user.id, updated_at: new Date() })
            }
            await this.attachLeaderMember(
              trx,
              project.id,
              {
                userId: leader.user.id,
                memberType: 'USER',
                memberName: normalized.leaderName,
                memberCode: normalized.leaderCode,
                role: 'LEADER',
                unit: normalized.unitName,
              },
              !!options.dryRun
            )
          } else {
            if (leader.kind === 'many') {
              summary.warnings.push(`[row ${normalized.rowNumber}] ambiguous leader: ${normalized.leaderName}`)
            } else {
              summary.warnings.push(`[row ${normalized.rowNumber}] leader not matched: ${normalized.leaderName}`)
            }
            summary.fallbackRawLeadersCreated++
            await this.attachLeaderMember(
              trx,
              project.id,
              {
                userId: null,
                memberType: 'EXTERNAL',
                memberName: normalized.leaderName,
                memberCode: normalized.leaderCode,
                role: 'LEADER',
                unit: normalized.unitName,
              },
              !!options.dryRun
            )
          }
        })
      } catch (error) {
        summary.errors.push(`[row ${normalized.rowNumber}] ${(error as Error).message}`)
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

  private static async loadUsersByStaffCode(): Promise<Map<string, UserLite[]>> {
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
    const rows = await db.from('departments').select('id', 'code', 'name')
    return rows.map((r) => ({
      id: Number(r.id),
      code: r.code ? String(r.code) : null,
      name: String(r.name || ''),
    }))
  }

  private static findUserByCodeOrName(
    leaderCode: string,
    leaderName: string,
    usersByCode: Map<string, UserLite[]>,
    usersByName: Map<string, UserLite[]>
  ): { kind: 'none' } | { kind: 'one'; user: UserLite } | { kind: 'many' } {
    const code = normalizeText(leaderCode || '')
    if (code) {
      const byCode = usersByCode.get(code) ?? []
      if (byCode.length === 1) return { kind: 'one', user: byCode[0] }
      if (byCode.length > 1) return { kind: 'many' }
    }

    const name = normalizeText(leaderName || '')
    if (name) {
      const byName = usersByName.get(name) ?? []
      if (byName.length === 1) return { kind: 'one', user: byName[0] }
      if (byName.length > 1) return { kind: 'many' }
    }

    return { kind: 'none' }
  }

  private static findDepartmentByCodeOrName(
    unitCode: string,
    unitName: string,
    departments: DepartmentLite[]
  ): number | null {
    const code = normalizeText(unitCode || '')
    if (code) {
      const exactByCode = departments.find((d) => normalizeText(d.code || '') === code)
      if (exactByCode) return exactByCode.id
    }

    const name = normalizeText(unitName || '')
    if (!name) return null

    const exactByName = departments.find((d) => normalizeText(d.name) === name)
    if (exactByName) return exactByName.id

    let bestId: number | null = null
    let bestScore = 0
    const targetTokens = new Set(name.split(' ').filter(Boolean))
    for (const dep of departments) {
      const depName = normalizeText(dep.name)
      let score = 0
      if (name.includes(depName) || depName.includes(name)) {
        const lenRatio = Math.min(name.length, depName.length) / Math.max(name.length, depName.length)
        score = 0.7 + 0.3 * lenRatio
      } else {
        const depTokens = new Set(depName.split(' ').filter(Boolean))
        let inter = 0
        for (const t of targetTokens) {
          if (depTokens.has(t)) inter++
        }
        const union = targetTokens.size + depTokens.size - inter
        if (union > 0) score = inter / union
      }
      if (score > bestScore) {
        bestScore = score
        bestId = dep.id
      }
    }
    return bestScore >= 0.45 ? bestId : null
  }

  private static async findOrCreateProject(
    trx: any,
    row: NormalizedResearchProjectRow,
    columns: {
      hasProposalId: boolean
      hasLeaderUserId: boolean
      hasDepartmentId: boolean
      hasApprovalStatus: boolean
      hasYear: boolean
      hasBudgetTotal: boolean
      hasStartDate: boolean
      hasEndDate: boolean
      hasLeaderUnit: boolean
      hasLeaderName: boolean
      hasStatus: boolean
      hasNote: boolean
      hasProjectType: boolean
    },
    departmentId: number | null,
    dryRun: boolean,
    summary: ResearchProjectImportSummary
  ): Promise<{ id: number; code: string } | null> {
    const code = (row.code || '').trim()
    const title = (row.title || '').trim()

    let found = null as any
    const scopeLecturerResearch = (q: any) => {
      if (columns.hasProjectType) return q.where('project_type', 'LECTURER_RESEARCH')
      return q
    }
    if (code) {
      found = await scopeLecturerResearch(trx.from('projects').where('code', code)).first()
    }
    if (!found && title) {
      found = await scopeLecturerResearch(
        trx.from('projects').whereRaw('LOWER(title) = ?', [title.toLowerCase()])
      ).first()
    }

    const normalizedApprovalStatus = normalizeApprovalStatus(row.approvalStatus)
    const normalizedProjectStatus = normalizeProjectStatus(row.projectStatus)
    const payloadBase: Record<string, unknown> = {
      code: code || null,
      title: title || null,
      field: null,
      level: null,
      academic_year: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    if (columns.hasYear) payloadBase.year = parseYear(row.acceptanceYear)
    if (columns.hasDepartmentId) payloadBase.department_id = departmentId
    if (columns.hasLeaderName) payloadBase.leader_name = row.leaderName || null
    if (columns.hasLeaderUnit) payloadBase.leader_unit = row.unitName || null
    if (columns.hasBudgetTotal) payloadBase.budget_total = parseNumber(row.budgetTotal)
    if (columns.hasStartDate) payloadBase.start_date = parseDate(row.startDate)
    if (columns.hasEndDate) payloadBase.end_date = parseDate(row.endDate)
    if (columns.hasApprovalStatus) payloadBase.approval_status = normalizedApprovalStatus
    if (columns.hasStatus) payloadBase.status = normalizedProjectStatus
    if (columns.hasNote) payloadBase.note = appendExtensionInfoToNote(null, row)
    if (columns.hasProjectType) payloadBase.project_type = 'LECTURER_RESEARCH'

    if (!found) {
      if (!payloadBase.code) {
        payloadBase.code = await this.generateProjectCode(trx)
      }
      if (!payloadBase.title) return null

      if (!dryRun) {
        const inserted = await trx.table('projects').insert(payloadBase).returning(['id', 'code'])
        found = Array.isArray(inserted) ? inserted[0] : inserted
      } else {
        found = { id: -Date.now(), code: String(payloadBase.code) }
      }
      summary.createdProjects++
      return { id: Number(found.id), code: String(found.code) }
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    const setIfMissing = (key: string, value: unknown) => {
      if ((found[key] === null || found[key] === '' || found[key] === undefined) && value !== null && value !== '') {
        updates[key] = value
      }
    }

    setIfMissing('title', payloadBase.title)
    if (columns.hasYear) setIfMissing('year', payloadBase.year)
    if (columns.hasDepartmentId) setIfMissing('department_id', payloadBase.department_id)
    if (columns.hasLeaderName) setIfMissing('leader_name', payloadBase.leader_name)
    if (columns.hasLeaderUnit) setIfMissing('leader_unit', payloadBase.leader_unit)
    if (columns.hasBudgetTotal) setIfMissing('budget_total', payloadBase.budget_total)
    if (columns.hasStartDate) setIfMissing('start_date', payloadBase.start_date)
    if (columns.hasEndDate) setIfMissing('end_date', payloadBase.end_date)
    if (columns.hasApprovalStatus) setIfMissing('approval_status', payloadBase.approval_status)
    if (columns.hasStatus) setIfMissing('status', payloadBase.status)
    if (columns.hasProjectType) setIfMissing('project_type', payloadBase.project_type)
    if (columns.hasNote) {
      const mergedNote = appendExtensionInfoToNote(found.note ? String(found.note) : null, row)
      if (mergedNote !== found.note) updates.note = mergedNote
    }

    if (Object.keys(updates).length > 1) {
      if (!dryRun) {
        await trx.from('projects').where('id', found.id).update(updates)
      }
      summary.updatedProjects++
    }
    return { id: Number(found.id), code: String(found.code) }
  }

  private static async attachLeaderMember(
    trx: any,
    projectId: number,
    payload: {
      userId: number | null
      memberType: MemberType
      memberName: string
      memberCode: string
      role: string
      unit: string
    },
    dryRun: boolean
  ): Promise<void> {
    let exists = null as any
    if (payload.userId) {
      exists = await trx
        .from('project_members')
        .where('project_id', projectId)
        .where('user_id', payload.userId)
        .first()
    } else if (payload.memberCode) {
      exists = await trx
        .from('project_members')
        .where('project_id', projectId)
        .where('member_code', payload.memberCode)
        .first()
    } else {
      exists = await trx
        .from('project_members')
        .where('project_id', projectId)
        .where('member_name', payload.memberName || null)
        .where('role', 'LEADER')
        .first()
    }
    if (exists) return

    const row = {
      project_id: projectId,
      member_type: payload.memberType,
      user_id: payload.userId,
      member_name: payload.memberName || null,
      member_code: payload.memberCode || null,
      email: null,
      role: payload.role || 'LEADER',
      is_main: true,
      unit: payload.unit || null,
      joined_at: null,
      note: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (!dryRun) {
      await trx.table('project_members').insert(row)
    }
  }

  private static async generateProjectCode(trx: any): Promise<string> {
    const y = new Date().getFullYear()
    const prefix = `NCKH-${y}-`
    const last = await trx
      .from('projects')
      .whereRaw('code LIKE ?', [`${prefix}%`])
      .orderBy('id', 'desc')
      .first()
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
      ) AS ok`,
      [tableName]
    )
    return Boolean(res.rows?.[0]?.ok)
  }

  private static async tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
    const res = await db.rawQuery(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ?
          AND column_name = ?
      ) AS ok`,
      [tableName, columnName]
    )
    return Boolean(res.rows?.[0]?.ok)
  }
}
