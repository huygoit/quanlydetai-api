import path from 'node:path'
import * as fs from 'node:fs'
import XLSX from 'xlsx'
import db from '@adonisjs/lucid/services/db'
import Department from '#models/department'
import Student from '#models/student'
import StartupProject from '#models/startup_project'
import StartupProjectMember from '#models/startup_project_member'
import ResearchStartupField from '#models/research_startup_field'
import StartupProjectHeaderResolver from '#services/imports/startup_project_header_resolver'
import StartupProjectRowMapper, {
  type NormalizedMemberRole,
  type NormalizedStartupProjectRow,
} from '#services/imports/startup_project_row_mapper'

interface LecturerLite {
  id: number
  full_name: string | null
}

interface ImportOptions {
  file: string
  sheet?: string
  createMissingFields?: boolean
}

export interface StartupProjectImportSummary {
  totalRowsRead: number
  normalizedRowsProcessed: number
  createdProjects: number
  updatedProjects: number
  attachedStudentMembers: number
  attachedLecturerMentors: number
  unmatchedStudents: number
  unmatchedLecturers: number
  createdFields: number
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

function makeFieldCode(name: string): string {
  const slug = normalizeText(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  const base = `STARTUP_${slug || 'FIELD'}`
  return base.slice(0, 100)
}

function shortHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h.toString(36).toUpperCase().slice(0, 6)
}

function makeRawMemberNote(rawName: string): string {
  return `RAW_MEMBER:${rawName}`
}

function inferDefaultYearFromSheetName(sheetName: string): string {
  const m = String(sheetName || '').match(/(19|20)\d{2}/g)
  if (!m || m.length === 0) return ''
  return m[m.length - 1]
}

export default class StartupProjectImportService {
  static async import(options: ImportOptions): Promise<StartupProjectImportSummary> {
    const summary: StartupProjectImportSummary = {
      totalRowsRead: 0,
      normalizedRowsProcessed: 0,
      createdProjects: 0,
      updatedProjects: 0,
      attachedStudentMembers: 0,
      attachedLecturerMentors: 0,
      unmatchedStudents: 0,
      unmatchedLecturers: 0,
      createdFields: 0,
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
    const sheetName = isCsv ? workbook.SheetNames[0] : options.sheet || 'SV_KhoiNghiep'
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      summary.errors.push(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`)
      return summary
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    summary.totalRowsRead = rows.length
    if (rows.length === 0) return summary

    const resolver = new StartupProjectHeaderResolver(Object.keys(rows[0] || {}))
    let context = StartupProjectRowMapper.createEmptyContext()
    const defaultYear = inferDefaultYearFromSheetName(sheetName)
    if (defaultYear) context.year = defaultYear
    const normalizedRows: NormalizedStartupProjectRow[] = []

    for (let i = 0; i < rows.length; i++) {
      const { normalized, nextContext } = StartupProjectRowMapper.normalizeRow(
        rows[i],
        i + 2,
        resolver,
        context
      )
      context = nextContext
      if (!normalized) {
        summary.skippedRows++
        continue
      }
      normalizedRows.push(normalized)
    }
    summary.normalizedRowsProcessed = normalizedRows.length

    const allStudents = await Student.query().select('id', 'full_name', 'first_name', 'last_name')
    const studentNameMap = new Map<string, Student[]>()
    for (const st of allStudents) {
      const names = [
        st.fullName,
        [st.firstName, st.lastName].filter(Boolean).join(' ').trim(),
        [st.lastName, st.firstName].filter(Boolean).join(' ').trim(),
      ].filter(Boolean) as string[]
      for (const n of names) {
        const key = normalizeText(n)
        const list = studentNameMap.get(key) ?? []
        list.push(st)
        studentNameMap.set(key, list)
      }
    }

    const hasLecturers = await this.tableExists('lecturers')
    const lecturers: LecturerLite[] = hasLecturers
      ? (
          await db
            .from('lecturers')
            .select('id', db.raw('COALESCE(full_name, name) as full_name'))
        ).map((r) => ({
          id: Number(r.id),
          full_name: r.full_name ? String(r.full_name) : null,
        }))
      : []
    const lecturerNameMap = new Map<string, LecturerLite[]>()
    for (const lec of lecturers) {
      if (!lec.full_name) continue
      const key = normalizeText(lec.full_name)
      const list = lecturerNameMap.get(key) ?? []
      list.push(lec)
      lecturerNameMap.set(key, list)
    }

    const hasFaculties = await this.tableExists('faculties')
    const facultyNameToId = new Map<string, number>()
    if (hasFaculties) {
      const facRows = await db.from('faculties').select('id', db.raw('COALESCE(name, full_name) as name'))
      for (const f of facRows) {
        if (!f.name) continue
        facultyNameToId.set(normalizeText(String(f.name)), Number(f.id))
      }
    }

    const projectCache = new Map<string, StartupProject>()
    const fieldCache = new Map<string, ResearchStartupField | null>()

    for (const row of normalizedRows) {
      try {
        if (!row.projectTitle) {
          summary.skippedRows++
          continue
        }

        const departmentId = await this.resolveDepartmentId(row.unitCode, row.unitName)
        const facultyId = hasFaculties ? (facultyNameToId.get(normalizeText(row.facultyName)) ?? null) : null
        const field = await this.resolveField(row.fieldName, !!options.createMissingFields, fieldCache)
        if (!field && row.fieldName) {
          summary.warnings.push(`[row ${row.rowNumber}] field not matched: ${row.fieldName}`)
        }
        if (field && field.$isNew === true) summary.createdFields++

        const yearNum = (() => {
          const y = parseInt(String(row.year || ''), 10)
          return Number.isNaN(y) ? null : y
        })()

        const cacheKey = `${normalizeText(row.projectTitle)}|${normalizeText(row.year)}|${normalizeText(row.unitCode)}`
        let project = projectCache.get(cacheKey)
        let isCreated = false
        if (!project) {
          project = await this.findProject(row.projectTitle, departmentId)
          if (!project) {
            isCreated = true
            project = await StartupProject.create({
              code: await this.generateProjectCode(row.year),
              title: row.projectTitle,
              researchStartupFieldId: field?.id ?? null,
              year: yearNum,
              facultyId,
              departmentId,
              status: 'APPROVED',
              problemStatement: row.shortDescription || null,
              isActive: true,
              note: [row.unitCode ? `unit_code=${row.unitCode}` : '', row.unitName ? `unit_name=${row.unitName}` : '', row.year ? `year=${row.year}` : '']
                .filter(Boolean)
                .join('; '),
            })
          } else {
            let changed = false
            if (project.year === null && yearNum !== null) {
              project.year = yearNum
              changed = true
            }
            if (!project.researchStartupFieldId && field?.id) {
              project.researchStartupFieldId = field.id
              changed = true
            }
            if (!project.departmentId && departmentId) {
              project.departmentId = departmentId
              changed = true
            }
            if (!project.facultyId && facultyId) {
              project.facultyId = facultyId
              changed = true
            }
            if (!project.problemStatement && row.shortDescription) {
              project.problemStatement = row.shortDescription
              changed = true
            }
            if (changed) {
              await project.save()
              summary.updatedProjects++
            }
          }
          projectCache.set(cacheKey, project)
        }

        if (isCreated) summary.createdProjects++

        if (row.advisorName && hasLecturers) {
          const advisorMatch = lecturerNameMap.get(normalizeText(row.advisorName)) ?? []
          if (advisorMatch.length === 1) {
            const mentor = advisorMatch[0]
            if (!project.mentorLecturerId) {
              project.mentorLecturerId = mentor.id
              await project.save()
              summary.updatedProjects++
            }
            const existsMentor = await StartupProjectMember.query()
              .where('startup_project_id', project.id)
              .where('lecturer_id', mentor.id)
              .first()
            if (!existsMentor) {
              await StartupProjectMember.create({
                startupProjectId: project.id,
                memberType: 'LECTURER',
                lecturerId: mentor.id,
                role: 'MENTOR',
                isMain: true,
                note: null,
              })
              summary.attachedLecturerMentors++
            }
          } else if (advisorMatch.length === 0) {
            summary.unmatchedLecturers++
            summary.warnings.push(`[row ${row.rowNumber}] advisor not matched: ${row.advisorName}`)
          } else {
            summary.unmatchedLecturers++
            summary.warnings.push(`[row ${row.rowNumber}] advisor ambiguous: ${row.advisorName}`)
          }
        }

        await this.attachStudentMember(project.id, row.memberName, row.memberRole, studentNameMap, summary, row.rowNumber)
      } catch (error) {
        summary.errors.push(`[row ${row.rowNumber}] ${(error as Error).message}`)
      }
    }

    return summary
  }

  private static async attachStudentMember(
    projectId: number,
    rawMemberName: string,
    role: NormalizedMemberRole,
    studentNameMap: Map<string, Student[]>,
    summary: StartupProjectImportSummary,
    rowNumber: number
  ): Promise<void> {
    if (!rawMemberName) return

    const matches = studentNameMap.get(normalizeText(rawMemberName)) ?? []
    const isMain = role === 'LEADER'

    if (matches.length === 1) {
      const student = matches[0]
      const exists = await StartupProjectMember.query()
        .where('startup_project_id', projectId)
        .where('student_id', student.id)
        .first()
      if (!exists) {
        await StartupProjectMember.create({
          startupProjectId: projectId,
          memberType: 'STUDENT',
          studentId: student.id,
          role,
          isMain,
          note: null,
        })
        summary.attachedStudentMembers++
      }
      return
    }

    if (matches.length > 1) {
      summary.warnings.push(`[row ${rowNumber}] student ambiguous: ${rawMemberName}`)
    } else {
      summary.unmatchedStudents++
      summary.warnings.push(`[row ${rowNumber}] student not matched: ${rawMemberName}`)
    }

    const rawNote = makeRawMemberNote(rawMemberName)
    const existsRaw = await StartupProjectMember.query()
      .where('startup_project_id', projectId)
      .where('member_type', 'STUDENT')
      .where('student_id', null)
      .where('note', rawNote)
      .first()
    if (!existsRaw) {
      await StartupProjectMember.create({
        startupProjectId: projectId,
        memberType: 'STUDENT',
        studentId: null,
        role,
        isMain,
        note: rawNote,
      })
      summary.attachedStudentMembers++
    }
  }

  private static async resolveDepartmentId(unitCode: string, unitName: string): Promise<number | null> {
    if (unitCode) {
      const byCode = await Department.query().whereRaw('LOWER(code) = ?', [unitCode.toLowerCase()]).first()
      if (byCode) return byCode.id
    }
    if (unitName) {
      const byName = await Department.query().whereRaw('LOWER(name) = ?', [unitName.toLowerCase()]).first()
      if (byName) return byName.id
    }
    return null
  }

  private static async resolveField(
    fieldName: string,
    createMissing: boolean,
    cache: Map<string, ResearchStartupField | null>
  ): Promise<ResearchStartupField | null> {
    if (!fieldName) return null
    const key = normalizeText(fieldName)
    if (cache.has(key)) return cache.get(key) ?? null

    const found = await ResearchStartupField.query()
      .whereRaw('LOWER(name) = ?', [fieldName.toLowerCase()])
      .whereIn('type', ['STARTUP', 'COMMON'])
      .first()
    if (found) {
      cache.set(key, found)
      return found
    }

    if (!createMissing) {
      cache.set(key, null)
      return null
    }

    let code = makeFieldCode(fieldName)
    if (code.length > 92) {
      code = `${code.slice(0, 92)}_${shortHash(fieldName)}`
    }

    const existedByCode = await ResearchStartupField.query().where('code', code).first()
    if (existedByCode) {
      cache.set(key, existedByCode)
      return existedByCode
    }

    let created: ResearchStartupField
    try {
      created = await ResearchStartupField.create({
        code,
        name: fieldName,
        type: 'STARTUP',
        parentId: null,
        description: null,
        isActive: true,
        sortOrder: 0,
      })
    } catch {
      const fallbackCode = `${code.slice(0, 90)}_${shortHash(`${fieldName}_${Date.now()}`)}`
      const existedFallback = await ResearchStartupField.query().where('code', fallbackCode).first()
      if (existedFallback) {
        cache.set(key, existedFallback)
        return existedFallback
      }
      created = await ResearchStartupField.create({
        code: fallbackCode,
        name: fieldName,
        type: 'STARTUP',
        parentId: null,
        description: null,
        isActive: true,
        sortOrder: 0,
      })
    }

    cache.set(key, created)
    return created
  }

  private static async findProject(title: string, departmentId: number | null): Promise<StartupProject | null> {
    const q = StartupProject.query().whereRaw('LOWER(title) = ?', [title.toLowerCase()])
    if (departmentId) {
      q.where('department_id', departmentId)
    }
    return q.first()
  }

  private static async generateProjectCode(yearRaw: string): Promise<string> {
    const y = parseInt(yearRaw, 10)
    const year = Number.isNaN(y) ? new Date().getFullYear() : y
    const prefix = `KN-${year}-`
    const last = await StartupProject.query()
      .whereRaw('code LIKE ?', [`${prefix}%`])
      .orderBy('id', 'desc')
      .first()
    let seq = 1
    if (last?.code) {
      const n = parseInt(last.code.split('-')[2] || '0', 10)
      if (!Number.isNaN(n)) seq = n + 1
    }
    return `${prefix}${String(seq).padStart(3, '0')}`
  }

  private static async tableExists(table: string): Promise<boolean> {
    const res = await db.rawQuery(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ?
      ) AS ok`,
      [table]
    )
    const row = res.rows?.[0]
    return Boolean(row?.ok)
  }
}
