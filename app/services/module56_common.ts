import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import type { ExecutionStatus } from '#constants/module56'
import { BUDGET_LINE_CODES, budgetLineLabel } from '#constants/module56'
import ProjectBudgetLine from '#models/project_budget_line'
import ProjectBudgetEntry from '#models/project_budget_entry'
import type { BudgetEntryType, BudgetSourceType } from '#models/project_budget_entry'
import PermissionService from '#services/permission_service'
import ProjectOutlineMember from '#models/project_outline_member'
import ScientificProfile from '#models/scientific_profile'
import type { StoredFile } from '#models/project_progress_report'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export function money(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) throw new Error('INVALID_AMOUNT')
  return Math.round(n)
}

export function approvedAmount(outline: ProjectOutline): number {
  return Math.round(
    Number(outline.approvedBudget ?? outline.confirmedBudget ?? outline.requestedBudget ?? 0)
  )
}

export function parseFiles(
  raw: unknown,
  opts: { required?: boolean; maxEach?: number; maxTotal?: number }
): StoredFile[] {
  if (raw == null) raw = []
  if (!Array.isArray(raw)) throw new Error('INVALID_FILES')
  const files: StoredFile[] = raw.map((item, i) => {
    const o = (item || {}) as Record<string, unknown>
    const fileUrl = String(o.fileUrl || o.file_url || '').trim()
    const fileName = String(o.fileName || o.file_name || `tep-${i + 1}`).trim()
    const sizeRaw = o.fileSize ?? o.file_size
    const fileSize = sizeRaw == null || sizeRaw === '' ? null : Number(sizeRaw)
    if (!fileUrl || !fileName) throw new Error('INVALID_FILES')
    if (fileSize != null && (!Number.isFinite(fileSize) || fileSize < 0)) {
      throw new Error('INVALID_FILES')
    }
    if (opts.maxEach && fileSize != null && fileSize > opts.maxEach) throw new Error('FILE_TOO_LARGE')
    return { fileName, fileUrl, fileSize }
  })
  if (opts.required && files.length === 0) throw new Error('FILE_REQUIRED')
  if (opts.maxTotal) {
    const known = files.every((f) => f.fileSize != null)
    if (known) {
      const total = files.reduce((s, f) => s + (f.fileSize || 0), 0)
      if (total > opts.maxTotal) throw new Error('FILE_TOO_LARGE')
    }
  }
  return files
}

export function parseOneFile(raw: unknown, maxEach?: number): StoredFile | null {
  if (raw == null) return null
  const list = parseFiles([raw], { maxEach })
  return list[0] || null
}

export async function loadOutline(id: number) {
  const row = await ProjectOutline.find(id)
  if (!row) throw new Error('OUTLINE_NOT_FOUND')
  return row
}

export function assertReady(outline: ProjectOutline) {
  if (outline.status !== 'SAN_SANG_THUC_HIEN' || !outline.module5Opened) {
    throw new Error('OUTLINE_NOT_READY')
  }
}

export function assertExecution(outline: ProjectOutline, allowed: ExecutionStatus[]) {
  if (!outline.executionStatus || !allowed.includes(outline.executionStatus as ExecutionStatus)) {
    throw new Error('BAD_EXECUTION_STATUS')
  }
}

export async function hasPerm(userId: number, code: string) {
  return PermissionService.userHasPermission(userId, code)
}

export async function assertPerm(userId: number, code: string) {
  if (!(await hasPerm(userId, code))) throw new Error('FORBIDDEN')
}

export async function isCnnv(userId: number, outline: ProjectOutline) {
  return outline.ownerId === userId
}

export async function assertCnnv(userId: number, outline: ProjectOutline) {
  if (!(await isCnnv(userId, outline))) throw new Error('FORBIDDEN')
}

export async function taskUserIds(outline: ProjectOutline) {
  const ids = new Set<number>()
  if (outline.ownerId) ids.add(outline.ownerId)
  const members = await ProjectOutlineMember.query().where('project_outline_id', outline.id)
  const profileIds = members.map((m) => m.profileId).filter((id): id is number => !!id)
  if (profileIds.length) {
    const profiles = await ScientificProfile.query().whereIn('id', profileIds).select('id', 'user_id')
    for (const p of profiles) {
      if (p.userId) ids.add(p.userId)
    }
  }
  return ids
}

export type LineBalance = {
  code: string
  label: string
  planned: number
  advanced: number
  spent: number
  settled: number
  remaining: number
}

export async function budgetSnapshot(outlineId: number): Promise<LineBalance[]> {
  const lines = await ProjectBudgetLine.query().where('project_outline_id', outlineId)
  const entries = await ProjectBudgetEntry.query().where('project_outline_id', outlineId)
  return BUDGET_LINE_CODES.map((code) => {
    const planned = Math.round(Number(lines.find((l) => l.code === code)?.amount || 0))
    const mine = entries.filter((e) => e.lineCode === code)
    const sum = (type: BudgetEntryType) =>
      mine
        .filter((e) => e.entryType === type)
        .reduce((s, e) => s + Math.round(Number(e.amount || 0)), 0)
    const advanced = sum('ADVANCE')
    const spent = sum('SPENT')
    const settled = sum('SETTLED')
    return {
      code,
      label: budgetLineLabel(code),
      planned,
      advanced,
      spent,
      settled,
      remaining: planned - spent - advanced,
    }
  })
}

export async function writeLedger(
  outlineId: number,
  lineCode: string,
  entryType: BudgetEntryType,
  amount: number,
  sourceType: BudgetSourceType,
  sourceId: number,
  actorId: number | null,
  note: string | null,
  trx?: TransactionClientContract
) {
  await ProjectBudgetEntry.create(
    {
      projectOutlineId: outlineId,
      lineCode,
      entryType,
      amount,
      sourceType,
      sourceId,
      note,
      createdBy: actorId,
    },
    trx ? { client: trx } : undefined
  )
}

export function iso(d: DateTime | null | undefined) {
  return d?.toISO() ?? null
}

export function today() {
  return DateTime.now().startOf('day')
}
