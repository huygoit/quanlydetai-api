import { DateTime } from 'luxon'
import fs from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ProjectContract from '#models/project_contract'
import ProjectFinalCase from '#models/project_final_case'
import ProjectOutline from '#models/project_outline'
import type { CouncilMember, ExplanationItem, FinalProduct, MinutesBody } from '#models/project_final_case'
import ProjectFinalSheet from '#models/project_final_sheet'
import ProjectAsset from '#models/project_asset'
import ProjectBudgetEntry from '#models/project_budget_entry'
import ProjectOutlineMember from '#models/project_outline_member'
import ScientificProfile from '#models/scientific_profile'
import ContractTemplateService from '#services/contract_template_service'
import ProjectOutlineService from '#services/project_outline_service'
import NotificationService from '#services/notification_service'
import AuditLogService from '#services/audit_log_service'
import PermissionService from '#services/permission_service'
import EmailLogService from '#services/email_log_service'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import {
  buildPublicGeneratedContractUrl,
  mergeDocxTemplate,
  resolveGeneratedContractDir,
} from '#utils/docx_merge_helper'
import { buildSanPhamYeuCauOoxml } from '#utils/outline_thuyet_minh_merge'
import { buildFormDocx } from '#utils/simple_docx'
import { canReopenFinalMinutes, hasCouncilQuorum } from '#services/module56_rules'
import {
  BUDGET_LINE_CODES,
  CLASSIFICATION_LABEL,
  COUNCIL_ROLE_LABEL,
  COUNCIL_ROLES,
  FILE_LIMIT,
  type BudgetLineCode,
  type CouncilRole,
  type FinalClassification,
} from '#constants/module56'
import { DATETIME_FORMAT } from '#constants/datetime_formats'
import { buildFinalCouncilInviteEmail } from '#utils/final_council_invite_email'
import {
  assertCnnv,
  assertExecution,
  assertPerm,
  assertReady,
  budgetSnapshot,
  hasPerm,
  isCnnv,
  iso,
  loadOutline,
  money,
  parseFiles,
  parseOneFile,
  taskUserIds,
  today,
  writeLedger,
} from '#services/module56_common'

/**
 * Module 6: nộp hồ sơ, hội đồng, BM.13, quyết toán, thanh lý BM.14.
 */
export default class ProjectFinalService {
  static async show(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline)
    const row = await this.ensure(outline.id)
    const sheets = await ProjectFinalSheet.query().where('project_outline_id', outline.id)
    const assets = await ProjectAsset.query().where('project_outline_id', outline.id)
    const finance = await budgetSnapshot(outline.id)
    return this.payload(outline, row, sheets, assets, finance, userId)
  }

  /**
   * Danh sách phiếu đánh giá KQCK của user (là thành viên hội đồng).
   * Dùng menu «Phiếu đánh giá KQCK của tôi».
   */
  static async listMyEvalSheets(userId: number) {
    const laThanhVien = (c: ProjectFinalCase) =>
      (c.councilMembers || []).some(
        (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
      )
    // Có trong council_members là đủ (không bắt buộc meeting_at)
    const allCases = await ProjectFinalCase.query().orderBy('id', 'desc').limit(800)
    const mine = allCases.filter(laThanhVien)
    if (!mine.length) return []

    const outlineIds = mine.map((c) => c.projectOutlineId)
    const outlines = await ProjectOutline.query().whereIn('id', outlineIds)
    const byOutline = new Map(outlines.map((o) => [o.id, o]))
    const sheets = await ProjectFinalSheet.query()
      .whereIn('project_outline_id', outlineIds)
      .where('user_id', userId)
    const sheetByOutline = new Map(sheets.map((s) => [s.projectOutlineId, s]))
    const contracts = await ProjectContract.query().whereIn('project_outline_id', outlineIds)
    const contractByOutline = new Map(contracts.map((c) => [c.projectOutlineId, c]))

    return mine
      .map((c) => {
        const outline = byOutline.get(c.projectOutlineId)
        if (!outline) return null
        const me = (c.councilMembers || []).find(
          (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
        )
        const sheet = sheetByOutline.get(c.projectOutlineId)
        const contract = contractByOutline.get(c.projectOutlineId)
        const role = String((me as any)?.role || '')
        return {
          outlineId: outline.id,
          code: outline.code,
          title: outline.title,
          ownerName: outline.ownerName,
          executionStatus: outline.executionStatus,
          meetingAt: iso(c.meetingAt),
          location: c.meetingLocation,
          role: role || null,
          roleLabel: role
            ? COUNCIL_ROLE_LABEL[role as keyof typeof COUNCIL_ROLE_LABEL] || role
            : null,
          sheetSubmittedAt: iso(sheet?.submittedAt || null),
          minutesLocked: !!c.minutesLocked,
          contractId: contract?.id || null,
          formPath: `/projects/final-eval/${outline.id}`,
        }
      })
      .filter(Boolean)
  }

  static async notify(outlineId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertReady(outline)
    assertExecution(outline, ['DANG_THUC_HIEN', 'DGCK_DRAFT', 'DGCK_BS'])
    const row = await this.ensure(outline.id)
    row.notifiedAt = DateTime.now()
    if (!outline.executionStatus) outline.executionStatus = 'DGCK_DRAFT'
    await row.save()
    await outline.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Thông báo đánh giá cuối kỳ',
        message: `${outline.code}: nộp hồ sơ BM.10/BM.11 trên hệ thống`,
        link: await this.contractTabPath(outline.id, 'denghi'),
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        'Thông báo đánh giá cuối kỳ',
        `${outline.code} đến hạn nộp hồ sơ đánh giá.`,
        'final_case',
        row.id
      )
    }
    return this.show(outline.id, userId)
  }

  static async saveDossier(outlineId: number, userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(outlineId)
    assertReady(outline)
    await assertCnnv(userId, outline)
    const row = await this.ensure(outline.id)
    const allowed = !outline.executionStatus || ['DANG_THUC_HIEN', 'DGCK_DRAFT', 'DGCK_BS'].includes(outline.executionStatus)
    if (!allowed) throw new Error('BAD_EXECUTION_STATUS')
    if (submit && !this.canSubmitNow(outline, row)) throw new Error('FINAL_NOT_OPEN')

    row.summaryFile = parseOneFile(body.summaryFile ?? body.summary_file, FILE_LIMIT.summary)
    row.briefFile = parseOneFile(body.briefFile ?? body.brief_file, FILE_LIMIT.brief)
    row.resultVi = String(body.resultVi ?? body.result_vi ?? '').trim() || null
    row.resultEn = String(body.resultEn ?? body.result_en ?? '').trim() || null
    row.products = this.parseProducts(outline, body.products)
    row.councilFile = parseOneFile(body.councilFile ?? body.council_file)
    row.publicationsNote = String(body.publicationsNote ?? body.publications_note ?? '').trim() || null
    if (!outline.executionStatus || outline.executionStatus === 'DANG_THUC_HIEN') {
      outline.executionStatus = 'DGCK_DRAFT'
    }
    if (submit) {
      if (!row.summaryFile || !row.briefFile || !row.resultVi || !row.resultEn) throw new Error('DOSSIER_INCOMPLETE')
      if ((outline.expectedProducts || []).length) {
        const missing = (row.products || []).some((p) => !p.fileUrl && !p.link)
        if (missing) throw new Error('DOSSIER_INCOMPLETE')
      }
      row.submittedAt = DateTime.now()
      outline.executionStatus = 'DGCK_CHO_PKH'
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ đánh giá cuối kỳ',
        message: outline.code,
        link: await this.contractTabPath(outline.id, 'nghiemthu'),
      })
    }
    await row.save()
    await outline.save()
    return this.show(outline.id, userId)
  }

  static async pkhDossier(outlineId: number, userId: number, accept: boolean, briefPagesOk: boolean, note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHO_PKH'])
    const row = await this.ensure(outline.id)
    row.pkhNote = note.trim() || null
    if (!accept) {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      outline.executionStatus = 'DGCK_BS'
      // Cho CNNV nộp lại: bỏ mốc đã nộp
      row.submittedAt = null
      await row.save()
      await outline.save()
      const link = await this.contractTabPath(outline.id, 'denghi')
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Yêu cầu bổ sung hồ sơ đề nghị đánh giá KQNV',
          message: `${outline.code}: ${note.trim()}`,
          link,
        })
        await EmailLogService.logStubToUser(
          outline.ownerId,
          `[KH&CN] Yêu cầu bổ sung hồ sơ đề nghị đánh giá — ${outline.code}`,
          [
            `Kính gửi ${outline.ownerName || 'Quý Thầy/Cô'},`,
            '',
            `Phòng Khoa học yêu cầu bổ sung hồ sơ đề nghị đánh giá kết quả nhiệm vụ ${outline.code}.`,
            '',
            `Nội dung cần bổ sung:`,
            note.trim(),
            '',
            `Vui lòng đăng nhập hệ thống để chỉnh sửa và nộp lại:`,
            link,
            '',
            'Trân trọng,',
            'Hệ thống Quản lý Khoa học và Công nghệ',
          ].join('\n'),
          'project_final_dossier_bs',
          row.id
        )
      }
      return this.show(outline.id, userId)
    }
    if (!briefPagesOk) throw new Error('BRIEF_PAGES_REQUIRED')
    row.briefPagesOk = true
    outline.executionStatus = 'DGCK_HOP_HD'
    await row.save()
    await outline.save()
    return this.show(outline.id, userId)
  }

  static async saveCouncil(outlineId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_HOP_HD'])
    const row = await this.ensure(outline.id)
    if (row.minutesLocked) throw new Error('MINUTES_LOCKED')
    const meetingAt = DateTime.fromISO(String(body.meetingAt || body.meeting_at || ''))
    if (!meetingAt.isValid) throw new Error('INVALID_DATE')
    const membersIn = Array.isArray(body.members) ? body.members : []
    const blocked = await taskUserIds(outline)
    const members: CouncilMember[] = []
    for (const raw of membersIn) {
      const item = raw as { userId?: number; role?: string }
      const role = String(item.role || '') as CouncilRole
      if (!COUNCIL_ROLES.includes(role)) throw new Error('INVALID_COUNCIL')
      const uid = Number(item.userId)
      const user = await User.find(uid)
      if (!user) throw new Error('USER_NOT_FOUND')
      if (blocked.has(user.id)) throw new Error('COUNCIL_CONFLICT')
      members.push({ userId: user.id, fullName: user.fullName, email: user.email, role })
    }
    const count = (role: CouncilRole) => members.filter((m) => m.role === role).length
    if (count('CHU_TICH') !== 1 || count('THU_KY') !== 1 || count('PHAN_BIEN') < 2) {
      throw new Error('INVALID_COUNCIL')
    }
    const days = meetingAt.startOf('day').diff(today(), 'days').days
    const tight = days < 7
    row.meetingAt = meetingAt
    row.meetingLocation = String(body.location || body.meetingLocation || '').trim() || null
    row.reviewDeadline = meetingAt.minus({ days: tight ? 1 : 7 })
    row.councilMembers = members
    await row.save()
    // Chuông + email: dẫn thẳng tới hồ sơ đề nghị đánh giá KQNV CNNV đã nộp
    // Link trang phiếu đánh giá KQCK độc lập
    const dossierPath = `/projects/final-eval/${outline.id}`
    const when = meetingAt.toFormat(DATETIME_FORMAT)
    for (const m of members) {
      await NotificationService.push(m.userId, {
        type: 'PROJECT_UPDATE',
        title: 'Mời hội đồng đánh giá cuối kỳ',
        message: `${outline.code} — họp ${when}. Vào phiếu đánh giá KQCK.`,
        link: dossierPath,
      })
      if (m.email) {
        const mail = buildFinalCouncilInviteEmail({
          code: outline.code,
          title: outline.title,
          ownerName: outline.ownerName,
          meetingAtLabel: when,
          location: row.meetingLocation,
          roleLabel: COUNCIL_ROLE_LABEL[m.role] || m.role,
          memberName: m.fullName,
          dossierPath,
        })
        await EmailLogService.logStub({
          toEmail: m.email,
          subject: mail.subject,
          body: mail.text,
          html: mail.html,
          relatedType: 'project_final_council',
          relatedId: row.id,
        })
      }
    }
    const data = await this.show(outline.id, userId)
    return { ...data, reviewDeadlineTight: tight }
  }

  static async remindMember(outlineId: number, userId: number, memberUserId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    const member = (row.councilMembers || []).find((m) => m.userId === memberUserId && m.role === 'PHAN_BIEN')
    if (!member) throw new Error('NOT_FOUND')
    await NotificationService.push(member.userId, {
      type: 'PROJECT_UPDATE',
      title: 'Nhắc nộp phiếu đánh giá KQCK',
      message: outline.code,
      link: `/projects/final-eval/${outline.id}`,
    })
    return { reminded: true }
  }

  static async saveSheet(outlineId: number, userId: number, body: Record<string, unknown>) {
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_HOP_HD'])
    const finalCase = await this.ensure(outline.id)
    // Mọi thành viên HĐ đều được nộp phiếu đánh giá
    const me = (finalCase.councilMembers || []).find(
      (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
    )
    if (!me) throw new Error('FORBIDDEN')
    if (finalCase.minutesLocked) throw new Error('MINUTES_LOCKED')

    const input = Array.isArray(body.productRows || body.product_rows)
      ? ((body.productRows || body.product_rows) as Record<string, unknown>[])
      : []

    // Phiếu KQCK mới: đánh dấu rõ hoặc nhận diện theo kết luận / kết quả BC
    const volumeHint = String(body.volumeComment || body.volume_comment || '').trim()
    const reportHint = String(body.reportComment || body.report_comment || '').trim()
    const isEvalV2 =
      body.evalVersion === 2 ||
      body.evalVersion === '2' ||
      ['DAT', 'KHONG_DAT'].includes(volumeHint) ||
      ['DAT_YEU_CAU', 'CAN_BO_SUNG', 'KHONG_DAT'].includes(reportHint) ||
      input.some(
        (r) =>
          r.soLuong != null ||
          r.chatLuong != null ||
          r.quantityOk != null ||
          r.qualityOk != null
      )

    let productRows: import('#models/project_final_sheet').SheetProductRow[]
    let volume: string
    let quality: string
    let report: string
    let general: string

    if (isEvalV2) {
      // Phiếu đánh giá theo hồ sơ đề nghị: số lượng / chất lượng + kết luận
      productRows = input.map((r) => {
        const soLuong = String(r.soLuong || r.quantityOk || '').trim() as 'DAT' | 'KHONG_DAT' | ''
        const chatLuong = String(r.chatLuong || r.qualityOk || '').trim() as 'DAT' | 'KHONG_DAT' | ''
        const soLuongNote = String(r.soLuongNote || '').trim()
        const chatLuongNote = String(r.chatLuongNote || '').trim()
        const note =
          String(r.note || r.comment || '').trim() ||
          [soLuongNote, chatLuongNote].filter(Boolean).join(' | ')
        if (soLuong !== 'DAT' && soLuong !== 'KHONG_DAT') throw new Error('SHEET_INCOMPLETE')
        if (chatLuong !== 'DAT' && chatLuong !== 'KHONG_DAT') throw new Error('SHEET_INCOMPLETE')
        if (soLuong === 'KHONG_DAT' && !soLuongNote && !note) throw new Error('SHEET_INCOMPLETE')
        if (chatLuong === 'KHONG_DAT' && !chatLuongNote && !note) throw new Error('SHEET_INCOMPLETE')
        return {
          key: String(r.key || '').trim() || undefined,
          name: String(r.name || r.title || '').trim(),
          soLuong,
          chatLuong,
          soLuongNote: soLuongNote || undefined,
          chatLuongNote: chatLuongNote || undefined,
          note,
          actual: soLuong,
          comment: note,
        }
      })
      if (productRows.some((r) => !r.name)) throw new Error('SHEET_INCOMPLETE')

      volume = String(body.volumeComment || body.volume_comment || '').trim() // Kết quả BC: DAT | KHONG_DAT
      quality = String(body.qualityComment || body.quality_comment || '').trim() // Ghi chú BC
      report = String(body.reportComment || body.report_comment || '').trim() // Kết luận
      general = String(body.generalComment || body.general_comment || '').trim()
      if (volume !== 'DAT' && volume !== 'KHONG_DAT') throw new Error('SHEET_INCOMPLETE')
      if (volume === 'KHONG_DAT' && !quality) throw new Error('SHEET_INCOMPLETE')
      if (!['DAT_YEU_CAU', 'CAN_BO_SUNG', 'KHONG_DAT'].includes(report)) {
        throw new Error('SHEET_INCOMPLETE')
      }
      if (report === 'CAN_BO_SUNG') {
        let okBoSung = false
        try {
          const meta = JSON.parse(general || '{}') as { supplementContent?: string }
          okBoSung = !!String(meta.supplementContent || '').trim()
        } catch {
          okBoSung = false
        }
        if (!okBoSung) throw new Error('SHEET_INCOMPLETE')
      }
    } else {
      // Phiếu BM.12a cũ (phản biện)
      if (me.role !== 'PHAN_BIEN') throw new Error('FORBIDDEN')
      volume = String(body.volumeComment || body.volume_comment || '').trim()
      quality = String(body.qualityComment || body.quality_comment || '').trim()
      report = String(body.reportComment || body.report_comment || '').trim()
      general = String(body.generalComment || body.general_comment || '').trim()
      if (!volume || !quality || !report || general.length < 100) throw new Error('SHEET_INCOMPLETE')
      productRows = (outline.expectedProducts || []).map((p) => {
        const hit = input.find((r) => String(r.name || '') === p.name)
        return {
          name: p.name,
          planned: [p.quantity, p.quality].filter(Boolean).join(' / '),
          actual: String(hit?.actual || '').trim(),
          comment: String(hit?.comment || '').trim(),
        }
      })
      if (productRows.some((r) => !r.actual || !r.comment)) throw new Error('SHEET_INCOMPLETE')
    }

    let sheet = await ProjectFinalSheet.query()
      .where('project_outline_id', outline.id)
      .where('user_id', userId)
      .first()
    if (!sheet) {
      sheet = new ProjectFinalSheet()
      sheet.projectOutlineId = outline.id
      sheet.userId = userId
    }
    if (sheet.submittedAt) throw new Error('MINUTES_LOCKED')
    sheet.productRows = productRows
    sheet.volumeComment = volume
    sheet.qualityComment = quality
    sheet.reportComment = report
    sheet.generalComment = general
    sheet.submittedAt = DateTime.now()
    await sheet.save()
    return { id: sheet.id, submittedAt: iso(sheet.submittedAt) }
  }

  static async saveMinutes(outlineId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_HOP_HD'])
    const row = await this.ensure(outline.id)
    if (row.minutesLocked) throw new Error('MINUTES_LOCKED')
    const members = row.councilMembers || []
    if (!members.length || !row.meetingAt) throw new Error('COUNCIL_REQUIRED')
    const present = (Array.isArray(body.presentUserIds) ? body.presentUserIds : []).map(Number)
    if (!hasCouncilQuorum(present.length, members.length)) throw new Error('QUORUM')
    const reviewers = members.filter((m) => m.role === 'PHAN_BIEN')
    const sheets = await ProjectFinalSheet.query()
      .where('project_outline_id', outline.id)
      .whereNotNull('submitted_at')
    for (const reviewer of reviewers) {
      if (!sheets.some((s) => s.userId === reviewer.userId)) throw new Error('SHEET_MISSING')
    }
    const classification = String(body.classification || '') as FinalClassification
    if (!['DAT_YEU_CAU', 'CAN_BO_SUNG', 'KHONG_DAT'].includes(classification)) {
      throw new Error('INVALID_CLASSIFICATION')
    }
    const discussion = String(body.discussion || '').trim()
    const volume = String(body.volume || '').trim()
    const quality = String(body.quality || '').trim()
    const recommendation = String(body.recommendation || '').trim()
    if (!discussion || !volume || !quality || !recommendation) throw new Error('MINUTES_INCOMPLETE')
    const lines = recommendation.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    const marksIn = Array.isArray(body.productMarks) ? body.productMarks : []
    const productMarks = (outline.expectedProducts || []).map((p) => {
      const hit = (marksIn as { name?: string; met?: boolean }[]).find((m) => m.name === p.name)
      return { name: p.name, met: !!hit?.met }
    })
    const absent = members.map((m) => m.userId).filter((id) => !present.includes(id))
    const minutes: MinutesBody = {
      discussion,
      volume,
      quality,
      recommendation,
      recommendationLines: lines.length ? lines : [recommendation],
      presentUserIds: present,
      absentUserIds: absent,
      productMarks,
    }
    const docBlocks = this.minuteBlocks(outline, row, minutes, classification, sheets)
    const buf = buildFormDocx('BIÊN BẢN HỌP HỘI ĐỒNG ĐÁNH GIÁ CUỐI KỲ', docBlocks)
    const dir = await resolveGeneratedContractDir()
    const stored = `BM12b_${outline.code}_${Date.now()}.docx`.replace(/[^\w.-]/g, '_')
    await fs.writeFile(`${dir}/${stored}`, buf)

    row.minutes = minutes
    row.minutesLocked = true
    row.classification = classification
    row.minutesFileName = `BM12b_${outline.code}.docx`
    row.minutesStoredFileName = stored
    row.minutesFileUrl = buildPublicGeneratedContractUrl(stored)
    if (classification === 'DAT_YEU_CAU') {
      outline.executionStatus = 'DGCK_CHO_QUYET_TOAN'
      row.settlementStatus = 'QT_DRAFT'
    } else if (classification === 'CAN_BO_SUNG') {
      outline.executionStatus = 'DGCK_CHINH_SUA'
      row.explanationStartedAt = DateTime.now()
      row.explanationDeadline = DateTime.now().plus({ days: 14 })
      row.explanationStatus = null
      row.remindedDay10 = false
      row.remindedDay13 = false
    } else {
      outline.executionStatus = 'DGCK_KHONG_DAT'
    }
    await row.save()
    await outline.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Đã có biên bản đánh giá cuối kỳ',
        message: `${outline.code}: ${CLASSIFICATION_LABEL[classification]}`,
        link: await this.contractTabPath(outline.id, 'danhgia'),
      })
    }
    return this.show(outline.id, userId)
  }

  /**
   * ADMIN mở lại biên bản đã khóa và kéo nhiệm vụ về bước họp,
   * chỉ khi quyết toán / giải trình chưa được nộp.
   */
  static async reopenMinutes(outlineId: number, userId: number, reason: string) {
    const note = String(reason || '').trim()
    if (note.length < 5) throw new Error('REASON_REQUIRED')
    const roles = await PermissionService.getUserRoles(userId)
    if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) throw new Error('FORBIDDEN')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    const duoc = canReopenFinalMinutes({
      minutesLocked: !!row.minutesLocked,
      executionStatus: outline.executionStatus,
      settlementStatus: row.settlementStatus,
      settlementLineCount: (row.settlementLines || []).length,
      settlementFileCount: (row.settlementFiles || []).length,
      explanationStatus: row.explanationStatus,
    })
    if (!duoc) throw new Error('MINUTES_REOPEN_BLOCKED')

    const truoc = {
      executionStatus: outline.executionStatus,
      classification: row.classification,
      settlementStatus: row.settlementStatus,
      minutesFileUrl: row.minutesFileUrl,
    }
    row.minutesLocked = false
    row.classification = null
    row.minutesFileName = null
    row.minutesStoredFileName = null
    row.minutesFileUrl = null
    row.settlementStatus = null
    row.explanationItems = []
    row.explanationReportFile = null
    row.explanationReturnReason = null
    row.explanationStartedAt = null
    row.explanationDeadline = null
    row.explanationStatus = null
    row.remindedDay10 = false
    row.remindedDay13 = false
    outline.executionStatus = 'DGCK_HOP_HD'
    await row.save()
    await outline.save()

    await ProjectOutlineService.writeAudit(
      outline.id,
      userId,
      'REOPEN_FINAL_MINUTES',
      truoc.executionStatus,
      'DGCK_HOP_HD',
      { reason: note }
    )
    const actor = await User.find(userId)
    await AuditLogService.log({
      userId,
      userName: actor?.fullName || 'ADMIN',
      action: 'REOPEN',
      entityType: 'PROJECT_FINAL_MINUTES',
      entityId: String(outline.id),
      oldData: truoc,
      newData: { executionStatus: 'DGCK_HOP_HD', reason: note },
    })
    return this.show(outline.id, userId)
  }

  static async decideFail(outlineId: number, userId: number, retry: boolean) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_KHONG_DAT'])
    const row = await this.ensure(outline.id)
    if (retry) {
      outline.executionStatus = 'DGCK_CHINH_SUA'
      row.explanationStartedAt = DateTime.now()
      row.explanationDeadline = DateTime.now().plus({ days: 14 })
      row.remindedDay10 = false
      row.remindedDay13 = false
    } else {
      outline.executionStatus = 'DGCK_DINH_CHI'
    }
    await row.save()
    await outline.save()
    return this.show(outline.id, userId)
  }

  static async saveExplanation(outlineId: number, userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(outlineId)
    await assertCnnv(userId, outline)
    assertExecution(outline, ['DGCK_CHINH_SUA'])
    const row = await this.ensure(outline.id)
    if (row.explanationStatus && row.explanationStatus !== 'TRA_LAI') throw new Error('BAD_STATUS')
    const lines = row.minutes?.recommendationLines || []
    const input = Array.isArray(body.items) ? (body.items as { response?: string }[]) : []
    if (input.length !== lines.length) throw new Error('EXPLANATION_MISMATCH')
    const items: ExplanationItem[] = lines.map((recommendation, i) => ({
      recommendation,
      response: String(input[i]?.response || '').trim(),
    }))
    if (submit && items.some((it) => !it.response)) throw new Error('EXPLANATION_MISMATCH')
    row.explanationItems = items
    row.explanationReportFile = parseOneFile(body.reportFile ?? body.report_file, FILE_LIMIT.summary)
    if (submit) {
      if (!row.explanationReportFile) throw new Error('FILE_REQUIRED')
      row.explanationStatus = 'CHO_THU_KY'
      row.explanationReturnReason = null
      row.secretaryConfirmedAt = null
      row.chairConfirmedAt = null
      const secretary = (row.councilMembers || []).find((m) => m.role === 'THU_KY')
      if (secretary) {
        await NotificationService.push(secretary.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Bản giải trình chờ thư ký',
          message: outline.code,
          link: await this.contractTabPath(outline.id, 'giaitrinh'),
        })
      }
    }
    await row.save()
    return this.show(outline.id, userId)
  }

  static async confirmExplanation(outlineId: number, userId: number, accept: boolean, reason: string) {
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHINH_SUA'])
    const row = await this.ensure(outline.id)
    const secretary = (row.councilMembers || []).find((m) => m.role === 'THU_KY')
    const chair = (row.councilMembers || []).find((m) => m.role === 'CHU_TICH')
    if (row.explanationStatus === 'CHO_THU_KY') {
      if (!secretary || secretary.userId !== userId) throw new Error('FORBIDDEN')
      if (!accept) return this.returnExplanation(row, outline, reason, userId)
      row.secretaryConfirmedAt = DateTime.now()
      row.explanationStatus = 'CHO_CHU_TICH'
      await row.save()
      if (chair) {
        await NotificationService.push(chair.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Bản giải trình chờ chủ tịch',
          message: outline.code,
          link: await this.contractTabPath(outline.id, 'giaitrinh'),
        })
      }
    } else if (row.explanationStatus === 'CHO_CHU_TICH') {
      if (!chair || chair.userId !== userId) throw new Error('FORBIDDEN')
      if (!accept) return this.returnExplanation(row, outline, reason, userId)
      row.chairConfirmedAt = DateTime.now()
      row.explanationStatus = 'XONG'
      outline.executionStatus = 'DGCK_CHO_QUYET_TOAN'
      row.settlementStatus = row.settlementStatus || 'QT_DRAFT'
      await row.save()
      await outline.save()
    } else {
      throw new Error('BAD_STATUS')
    }
    return this.show(outline.id, userId)
  }

  static async extendExplanation(outlineId: number, userId: number, deadline: string) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHINH_SUA'])
    const row = await this.ensure(outline.id)
    const d = DateTime.fromISO(deadline)
    if (!d.isValid) throw new Error('INVALID_DATE')
    row.explanationDeadline = d
    row.remindedDay10 = false
    row.remindedDay13 = false
    await row.save()
    return this.show(outline.id, userId)
  }

  static async saveSettlement(outlineId: number, userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(outlineId)
    await assertCnnv(userId, outline)
    assertExecution(outline, ['DGCK_CHO_QUYET_TOAN'])
    const row = await this.ensure(outline.id)
    if (row.settlementStatus && !['QT_DRAFT', 'QT_BS'].includes(row.settlementStatus)) {
      throw new Error('BAD_STATUS')
    }
    const input = Array.isArray(body.lines) ? (body.lines as { code: string; declaredAmount: number }[]) : []
    const map = new Map<string, number>()
    for (const line of input) {
      if (!BUDGET_LINE_CODES.includes(line.code as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
      map.set(line.code, money(line.declaredAmount ?? (line as { declared_amount?: number }).declared_amount))
    }
    if (map.size !== BUDGET_LINE_CODES.length) throw new Error('BUDGET_LINES_INCOMPLETE')
    row.settlementLines = BUDGET_LINE_CODES.map((code) => ({
      code,
      declaredAmount: map.get(code) || 0,
    }))
    row.settlementFiles = parseFiles(body.files ?? body.attachments, { required: submit })
    row.varianceAck = false
    row.varianceReason = null
    if (submit) row.settlementStatus = 'QT_CHO_PKH'
    else row.settlementStatus = 'QT_DRAFT'
    await row.save()
    return this.show(outline.id, userId)
  }

  static async pkhSettlement(outlineId: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    if (row.settlementStatus !== 'QT_CHO_PKH') throw new Error('BAD_STATUS')
    if (!accept) {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      row.settlementStatus = 'QT_BS'
      row.settlementReturnReason = note.trim()
    } else {
      row.settlementStatus = 'QT_CHO_TC'
      row.settlementReturnReason = null
      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Quyết toán chờ KH-TC',
        message: outline.code,
        link: await this.contractTabPath(outline.id, 'quyettoan'),
      })
    }
    await row.save()
    return this.show(outline.id, userId)
  }

  static async ackVariance(outlineId: number, userId: number, reason: string) {
    await assertPerm(userId, 'project.contract_manage')
    if (!reason.trim()) throw new Error('REASON_REQUIRED')
    const row = await this.ensure(outlineId)
    if (!row.settlementStatus || !['QT_CHO_PKH', 'QT_CHO_TC'].includes(row.settlementStatus)) {
      throw new Error('BAD_STATUS')
    }
    row.varianceAck = true
    row.varianceReason = reason.trim()
    await row.save()
    return this.show(outlineId, userId)
  }

  static async tcSettlement(outlineId: number, userId: number, accept: boolean, date: string, reason: string) {
    await assertPerm(userId, 'project.budget_confirm')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHO_QUYET_TOAN'])
    const row = await this.ensure(outline.id)
    if (row.settlementStatus !== 'QT_CHO_TC') throw new Error('BAD_STATUS')
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.settlementStatus = 'QT_BS'
      row.settlementReturnReason = reason.trim()
      await row.save()
      return this.show(outline.id, userId)
    }
    const snap = await budgetSnapshot(outline.id)
    const mismatch = (row.settlementLines || []).some((line) => {
      const spent = snap.find((s) => s.code === line.code)?.spent || 0
      return Number(line.declaredAmount) !== spent
    })
    if (mismatch && !row.varianceAck) throw new Error('VARIANCE_UNACK')
    const settledOn = DateTime.fromISO(date)
    if (!settledOn.isValid) throw new Error('INVALID_DATE')
    await db.transaction(async (trx) => {
      await ProjectBudgetEntry.query({ client: trx })
        .where('project_outline_id', outline.id)
        .where('entry_type', 'SETTLED')
        .delete()
      for (const line of row.settlementLines || []) {
        await writeLedger(outline.id, line.code, 'SETTLED', Number(line.declaredAmount), 'QT', row.id, userId, null, trx)
      }
      row.useTransaction(trx)
      outline.useTransaction(trx)
      row.settlementStatus = 'QT_DONE'
      row.settlementDate = settledOn
      row.liquidationStatus = 'TL_DRAFT'
      outline.executionStatus = 'DGCK_CHO_THANH_LY'
      await row.save()
      await outline.save()
    })
    return this.show(outline.id, userId)
  }

  static async saveLiquidation(outlineId: number, userId: number, body: Record<string, unknown>) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHO_THANH_LY'])
    const row = await this.ensure(outline.id)
    if (row.liquidationStatus && !['TL_DRAFT', 'TL_TRA_LAI'].includes(row.liquidationStatus)) {
      throw new Error('BAD_STATUS')
    }
    const handling = String(body.surplusHandling || body.surplus_handling || '')
    if (handling !== 'HOAN_TRA' && handling !== 'KHONG_PHAT_SINH') throw new Error('SURPLUS_REQUIRED')
    row.surplusHandling = handling
    row.recognitionFileUrl = String(body.recognitionFileUrl || body.recognition_file_url || '').trim() || null
    if (Array.isArray(body.assets)) {
      await ProjectAsset.query().where('project_outline_id', outline.id).delete()
      const assets = (body.assets as Record<string, unknown>[]).filter((a) => String(a.name || '').trim())
      if (assets.length) {
        await ProjectAsset.createMany(
          assets.map((a) => ({
            projectOutlineId: outline.id,
            procurementId: null,
            name: String(a.name),
            quantity: a.quantity == null ? null : String(a.quantity),
            amount: money(a.amount || 0),
            note: a.note ? String(a.note) : null,
          }))
        )
      }
    }
    row.liquidationStatus = 'TL_DRAFT'
    await row.save()
    return this.show(outline.id, userId)
  }

  static async submitLiquidation(outlineId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHO_THANH_LY'])
    const row = await this.ensure(outline.id)
    if (!row.surplusHandling) throw new Error('SURPLUS_REQUIRED')
    await this.writeLiquidationFile(outline, row)
    row.liquidationStatus = 'TL_CHO_BGH'
    await row.save()
    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Biên bản thanh lý chờ ký',
      message: outline.code,
      link: await this.contractTabPath(outline.id, 'thanhly'),
    })
    return this.show(outline.id, userId)
  }

  static async bghLiquidation(outlineId: number, userId: number, accept: boolean, reason: string) {
    await assertPerm(userId, 'project.outline_approve')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    if (row.liquidationStatus !== 'TL_CHO_BGH') throw new Error('BAD_STATUS')
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.liquidationStatus = 'TL_DRAFT'
      row.liquidationReturnReason = reason.trim()
      await row.save()
      return this.show(outline.id, userId)
    }
    row.liqBghSignedAt = DateTime.now()
    row.liquidationStatus = 'TL_CHO_PHAT_HANH'
    row.liquidationReturnReason = null
    await row.save()
    await NotificationService.pushToPermission('project.contract_publish', {
      type: 'PROJECT_UPDATE',
      title: 'Thanh lý chờ phát hành',
      message: outline.code,
      link: await this.contractTabPath(outline.id, 'thanhly'),
    })
    return this.show(outline.id, userId)
  }

  static async publishLiquidation(outlineId: number, userId: number, issueNo: string) {
    await assertPerm(userId, 'project.contract_publish')
    const no = issueNo.trim()
    if (!no) throw new Error('ISSUE_NO_REQUIRED')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    if (row.liquidationStatus !== 'TL_CHO_PHAT_HANH') throw new Error('BAD_STATUS')
    row.liqIssueNo = no
    row.liqPublishedAt = DateTime.now()
    row.liquidationStatus = 'TL_CHO_CNNV'
    await row.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Biên bản thanh lý chờ xác nhận',
        message: `${outline.code}: số ${no}`,
        link: await this.contractTabPath(outline.id, 'thanhly'),
      })
    }
    return this.show(outline.id, userId)
  }

  static async cnnvLiquidation(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await assertCnnv(userId, outline)
    const row = await this.ensure(outline.id)
    if (row.liquidationStatus !== 'TL_CHO_CNNV') throw new Error('BAD_STATUS')
    row.liqCnnvSignedAt = DateTime.now()
    row.liquidationStatus = 'TL_HIEU_LUC'
    outline.executionStatus = 'HOAN_THANH'
    await row.save()
    await outline.save()
    await this.writeProfiles(outline, row.classification)
    return this.show(outline.id, userId)
  }

  static async sendExplanationReminders() {
    const rows = await ProjectFinalCase.query().whereNotNull('explanation_started_at')
    let sent = 0
    for (const row of rows) {
      if (!row.explanationStartedAt || !row.explanationDeadline) continue
      if (row.explanationStatus === 'XONG') continue
      const start = row.explanationStartedAt.startOf('day')
      const day = Math.round(today().diff(start, 'days').days) + 1
      const outline = await loadOutline(row.projectOutlineId)
      if (outline.executionStatus !== 'DGCK_CHINH_SUA' || !outline.ownerId) continue
      if (day === 10 && !row.remindedDay10) {
        await this.remindExplanation(outline.ownerId, outline.id, 10)
        row.remindedDay10 = true
        await row.save()
        sent += 1
      }
      if (day === 13 && !row.remindedDay13) {
        await this.remindExplanation(outline.ownerId, outline.id, 13)
        row.remindedDay13 = true
        await row.save()
        sent += 1
      }
    }
    return sent
  }

  private static async remindExplanation(userId: number, outlineId: number, day: number) {
    const title = `Nhắc hoàn thiện hồ sơ (ngày ${day}/14)`
    const link = await this.contractTabPath(outlineId, 'giaitrinh')
    await NotificationService.push(userId, {
      type: 'PROJECT_UPDATE',
      title,
      message: `Nhiệm vụ #${outlineId}`,
      link,
    })
    await EmailLogService.logStubToUser(userId, title, `Nhiệm vụ #${outlineId}`, 'final_case', outlineId)
  }

  private static async returnExplanation(
    row: ProjectFinalCase,
    outline: Awaited<ReturnType<typeof loadOutline>>,
    reason: string,
    actorId: number
  ) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED')
    row.explanationStatus = 'TRA_LAI'
    row.explanationReturnReason = reason.trim()
    row.secretaryConfirmedAt = null
    row.chairConfirmedAt = null
    await row.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Giải trình cần sửa',
        message: reason.trim(),
        link: await this.contractTabPath(outline.id, 'giaitrinh'),
      })
    }
    return this.show(outline.id, actorId)
  }

  /** CNNV được nộp hồ sơ nghiệm thu bất cứ lúc nào (hoàn thành trước hạn). */
  private static canSubmitNow(_outline: Awaited<ReturnType<typeof loadOutline>>, _row: ProjectFinalCase) {
    return true
  }

  private static parseProducts(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    raw: unknown
  ): FinalProduct[] {
    const input = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
    return (outline.expectedProducts || []).map((p) => {
      const hit = input.find((r) => String(r.name || '') === p.name)
      const fileUrl = String(hit?.fileUrl || hit?.file_url || '').trim() || null
      const link = String(hit?.link || '').trim() || null
      if (!fileUrl && !link) return { name: p.name, fileUrl: null, link: null }
      return { name: p.name, fileUrl, link }
    })
  }

  private static async ensure(outlineId: number) {
    let row = await ProjectFinalCase.query().where('project_outline_id', outlineId).first()
    if (!row) {
      row = await ProjectFinalCase.create({
        projectOutlineId: outlineId,
        briefPagesOk: false,
        minutesLocked: false,
        remindedDay10: false,
        remindedDay13: false,
        varianceAck: false,
      })
    }
    return row
  }

  /** Link FE chi tiết HĐ + tab (ưu tiên hồ sơ đề nghị đánh giá). */
  private static async contractTabPath(outlineId: number, tab = 'denghi') {
    const contract = await ProjectContract.query().where('project_outline_id', outlineId).first()
    if (contract) {
      return `/projects/contracts/${contract.id}?tab=${tab}`
    }
    return `/projects/execution/${outlineId}`
  }

  private static async assertSee(userId: number, outline: Awaited<ReturnType<typeof loadOutline>>) {
    if (await isCnnv(userId, outline)) return
    const row = await ProjectFinalCase.query().where('project_outline_id', outline.id).first()
    if (
      (row?.councilMembers || []).some(
        (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
      )
    ) {
      return
    }
    if (
      (await hasPerm(userId, 'project.contract_manage')) ||
      (await hasPerm(userId, 'project.outline_approve')) ||
      (await hasPerm(userId, 'project.contract_publish')) ||
      (await hasPerm(userId, 'project.budget_confirm')) ||
      (await hasPerm(userId, 'project.view'))
    ) {
      return
    }
    throw new Error('FORBIDDEN')
  }

  private static async payload(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    row: ProjectFinalCase,
    sheets: ProjectFinalSheet[],
    assets: ProjectAsset[],
    finance: Awaited<ReturnType<typeof budgetSnapshot>>,
    _userId: number
  ) {
    const advanced = finance.reduce((s, l) => s + l.advanced, 0)
    const spent = finance.reduce((s, l) => s + l.spent, 0)
    const settled = finance.reduce((s, l) => s + l.settled, 0)
    return {
      projectOutlineId: outline.id,
      code: outline.code,
      title: outline.title,
      executionStatus: outline.executionStatus,
      /** Dùng form phiếu đánh giá KQCK (thành viên HĐ không gọi được getOutline) */
      expectedResults: outline.expectedResults || null,
      overdueExplanation: !!(
        row.explanationDeadline &&
        outline.executionStatus === 'DGCK_CHINH_SUA' &&
        today() > row.explanationDeadline.startOf('day')
      ),
      dossier: {
        notifiedAt: iso(row.notifiedAt),
        submittedAt: iso(row.submittedAt),
        summaryFile: row.summaryFile,
        briefFile: row.briefFile,
        briefPagesOk: row.briefPagesOk,
        resultVi: row.resultVi,
        resultEn: row.resultEn,
        products: row.products || [],
        councilFile: row.councilFile,
        publicationsNote: row.publicationsNote,
        pkhNote: row.pkhNote,
      },
      council: {
        meetingAt: iso(row.meetingAt),
        location: row.meetingLocation,
        reviewDeadline: iso(row.reviewDeadline),
        members: row.councilMembers || [],
      },
      sheets: sheets.map((s) => ({
        userId: s.userId,
        productRows: s.productRows,
        volumeComment: s.volumeComment,
        qualityComment: s.qualityComment,
        reportComment: s.reportComment,
        generalComment: s.generalComment,
        submittedAt: iso(s.submittedAt),
      })),
      minutes: row.minutes,
      minutesLocked: row.minutesLocked,
      minutesFileUrl: row.minutesFileUrl,
      classification: row.classification,
      explanation: {
        status: row.explanationStatus,
        items: row.explanationItems || [],
        deadline: iso(row.explanationDeadline),
        reportFile: row.explanationReportFile,
        returnReason: row.explanationReturnReason,
      },
      settlement: {
        status: row.settlementStatus,
        lines: row.settlementLines || [],
        files: row.settlementFiles || [],
        varianceAck: row.varianceAck,
        varianceReason: row.varianceReason,
        date: row.settlementDate?.toISODate() ?? null,
        returnReason: row.settlementReturnReason,
      },
      liquidation: {
        status: row.liquidationStatus,
        surplusHandling: row.surplusHandling,
        surplus: advanced + spent - settled,
        recognitionFileUrl: row.recognitionFileUrl,
        fileUrl: row.liquidationFileUrl,
        issueNo: row.liqIssueNo,
        bghSignedAt: iso(row.liqBghSignedAt),
        publishedAt: iso(row.liqPublishedAt),
        cnnvSignedAt: iso(row.liqCnnvSignedAt),
      },
      finance: { advanced, spent, settled, lines: finance },
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        quantity: a.quantity,
        amount: Number(a.amount || 0),
        note: a.note,
      })),
    }
  }

  private static minuteBlocks(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    row: ProjectFinalCase,
    minutes: MinutesBody,
    classification: FinalClassification,
    sheets: ProjectFinalSheet[]
  ) {
    const members = (row.councilMembers || []).map((m) => {
      const present = minutes.presentUserIds.includes(m.userId) ? 'có mặt' : 'vắng'
      return `${m.fullName} (${m.role}) — ${present}`
    })
    return [
      {
        heading: '1. Nhiệm vụ',
        lines: [
          `${outline.title} (${outline.code})`,
          `Chủ nhiệm: ${outline.ownerName || ''}. Đơn vị: ${outline.ownerUnit || ''}`,
        ],
      },
      { heading: '2. Hợp đồng', lines: [`Hồ sơ nhiệm vụ ${outline.code}`] },
      {
        heading: '3. Thời gian và địa điểm',
        lines: [
          `Thời gian họp: ${row.meetingAt?.toFormat(DATETIME_FORMAT) || ''}`,
          `Địa điểm: ${row.meetingLocation || ''}`,
        ],
      },
      { heading: '4. Thành phần hội đồng', lines: members.length ? members : ['(chưa có)'] },
      { heading: '5. Hồ sơ', lines: ['Hồ sơ đã nộp theo checklist đánh giá cuối kỳ.'] },
      {
        heading: '6. Tóm tắt phiếu nhận xét',
        lines: sheets.length
          ? sheets.map((s) => `User ${s.userId}: ${s.generalComment || ''}`)
          : ['(không có phiếu)'],
      },
      { heading: '7. Ý kiến thảo luận', lines: [minutes.discussion] },
      {
        heading: '8. Sản phẩm',
        lines: minutes.productMarks.map((p) => `${p.name}: ${p.met ? 'đáp ứng' : 'không đáp ứng'}`),
      },
      {
        heading: '9. Kết luận',
        lines: [
          `Khối lượng: ${minutes.volume}`,
          `Chất lượng: ${minutes.quality}`,
          `Xếp loại: ${CLASSIFICATION_LABEL[classification]}`,
          `Kiến nghị: ${minutes.recommendation}`,
        ],
      },
      { heading: '10. Xác nhận', lines: ['Thư ký và chủ tịch xác nhận trên hệ thống.'] },
    ]
  }

  private static async writeLiquidationFile(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    row: ProjectFinalCase
  ) {
    const finance = await budgetSnapshot(outline.id)
    const advanced = finance.reduce((s, l) => s + l.advanced, 0)
    const spent = finance.reduce((s, l) => s + l.spent, 0)
    const settled = finance.reduce((s, l) => s + l.settled, 0)
    const assets = await ProjectAsset.query().where('project_outline_id', outline.id)
    const data: Record<string, string> = {
      ten_nhiem_vu: outline.title,
      ma_nhiem_vu: outline.code,
      xep_loai: row.classification ? CLASSIFICATION_LABEL[row.classification] : '',
      kinh_phi_da_cap: String(advanced + spent),
      kinh_phi_quyet_toan: String(settled),
      ton: String(advanced + spent - settled),
      xu_ly_ton: row.surplusHandling === 'HOAN_TRA' ? 'Hoàn trả' : 'Không phát sinh',
      ngay_quyet_toan: row.settlementDate?.toFormat('dd/MM/yyyy') || '',
      tai_san: assets.map((a) => `${a.name} (${a.quantity || ''})`).join('; '),
    }
    const template = await ContractTemplateService.getDefaultActive('THANH_LY')
    if (template) {
      const templatePath = await findContractTemplateFilePath(template.storedFileName)
      if (templatePath) {
        try {
          const merged = await mergeDocxTemplate({
            templatePath,
            data,
            outputFileName: `BM14_${outline.code}_${Date.now()}.docx`.replace(/[^\w.-]/g, '_'),
          })
          row.liquidationFileName = merged.storedFileName
          row.liquidationStoredFileName = merged.storedFileName
          row.liquidationFileUrl = merged.fileUrl
          return
        } catch {
          // Mẫu thanh lý có thể chưa đúng biến — ghi DOCX tối thiểu.
        }
      }
    }
    const buf = buildFormDocx('BIÊN BẢN THANH LÝ HỢP ĐỒNG', [
      { heading: 'Điều 1. Xếp loại', lines: [data.xep_loai || '(chưa xếp)'] },
      {
        heading: 'Điều 2. Kinh phí',
        lines: [
          `Nhiệm vụ: ${data.ten_nhiem_vu} (${data.ma_nhiem_vu})`,
          `Đã cấp: ${data.kinh_phi_da_cap}`,
          `Quyết toán: ${data.kinh_phi_quyet_toan}`,
          `Tồn: ${data.ton}. Xử lý: ${data.xu_ly_ton}`,
          `Ngày quyết toán: ${data.ngay_quyet_toan}`,
        ],
      },
      { heading: 'Điều 3. Tài sản', lines: [data.tai_san || '(không)'] },
    ])
    const dir = await resolveGeneratedContractDir()
    const stored = `BM14_${outline.code}_${Date.now()}.docx`.replace(/[^\w.-]/g, '_')
    await fs.writeFile(`${dir}/${stored}`, buf)
    row.liquidationFileName = stored
    row.liquidationStoredFileName = stored
    row.liquidationFileUrl = buildPublicGeneratedContractUrl(stored)
  }

  /**
   * Xuất DOCX đơn đề nghị đánh giá KQNV (BM-05.01) từ mẫu DON_DE_NGHI mặc định.
   */
  static async exportDonDeNghi(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline)
    const template = await ContractTemplateService.getDefaultActive('DON_DE_NGHI')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')
    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    const hopDong = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'desc')
      .first()
    const now = DateTime.now()
    const ngayLap = `ngày ${now.toFormat('dd')} tháng ${now.toFormat('MM')} năm ${now.toFormat('yyyy')}`
    const start = outline.startDate?.toFormat('dd/MM/yyyy') || ''
    const end = outline.endDate?.toFormat('dd/MM/yyyy') || ''
    const giaHan =
      Number(outline.extensionCount || 0) > 0
        ? `${outline.extensionCount} lần`
        : ''

    const data: Record<string, string> = {
      ngay_lap: ngayLap,
      ten_nhiem_vu: outline.title || '',
      ma_so: outline.code || '',
      cap_quan_ly: outline.level || '',
      so_qd_hd: hopDong?.contractNo || '',
      ngay_qd_hd: hopDong?.createdAt?.toFormat('dd/MM/yyyy') || '',
      chu_nhiem: outline.ownerName || '',
      to_chuc_chu_tri: outline.hostUnit || outline.ownerUnit || '',
      thoi_gian_tu: start,
      thoi_gian_den: end,
      gia_han: giaHan,
    }

    const safeCode = (outline.code || String(outline.id)).replace(/[^\w.-]/g, '_')
    const merged = await mergeDocxTemplate({
      templatePath,
      data,
      outputFileName: `BM0501_${safeCode}_${Date.now()}.docx`,
    })
    return {
      fileName: `BM-05.01_Don_de_nghi_${safeCode}.docx`,
      fullPath: merged.fullPath,
      fileUrl: merged.fileUrl,
    }
  }

  /**
   * Xuất DOCX báo cáo tổng kết (BM-05.02) từ mẫu BAO_CAO_TONG_KET.
   * Thông tin chung: biến theo từng dòng. bang_san_pham: cả bảng.
   */
  static async exportBaoCaoTongKet(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline)
    const template = await ContractTemplateService.getDefaultActive('BAO_CAO_TONG_KET')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')
    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    const hopDong = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'desc')
      .first()
    const now = DateTime.now()
    const ngayLap = `ngày ${now.toFormat('dd')} tháng ${now.toFormat('MM')} năm ${now.toFormat('yyyy')}`
    const start = outline.startDate?.toFormat('dd/MM/yyyy') || ''
    const end = outline.endDate?.toFormat('dd/MM/yyyy') || ''
    const giaHan =
      Number(outline.extensionCount || 0) > 0 ? ` (gia hạn: ${outline.extensionCount} lần)` : ''
    const kinhPhi = Number(outline.approvedBudget ?? outline.confirmedBudget ?? 0)
    const soHd = hopDong?.contractNo || ''
    const ngayHd = hopDong?.createdAt?.toFormat('dd/MM/yyyy') || ''
    const toChucChuTri =
      outline.hostOrganization?.name?.trim() ||
      outline.hostUnit?.trim() ||
      outline.ownerUnit?.trim() ||
      ''
    // Đơn vị phối hợp lấy từ thuyết minh (partnerUnits)
    const donViPhoiHop = (outline.partnerUnits || [])
      .map((p) => {
        const ten = String(p?.name || '').trim()
        if (!ten) return ''
        const extras = [p?.orgCode, p?.phone, p?.address]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
        return extras.length ? `${ten} (${extras.join(', ')})` : ten
      })
      .filter(Boolean)
      .join('; ')

    // Các bảng sản phẩm giống thuyết minh — chỉ xuất nhóm có dữ liệu
    const erGoc = outline.expectedResults
    const erLoc = {
      publications: (erGoc?.publications || []).filter((r) => r.content?.trim()),
      appliedProducts: (erGoc?.appliedProducts || []).filter((r) => r.name?.trim()),
      tangibleProducts: (erGoc?.tangibleProducts || []).filter((r) => r.name?.trim()),
      ipProducts: (erGoc?.ipProducts || []).filter((r) => r.name?.trim()),
      postgraduateTraining: (erGoc?.postgraduateTraining || []).filter(
        (r) => r.level?.trim() || r.major?.trim()
      ),
    }
    let bangSanPham = buildSanPhamYeuCauOoxml(erLoc)
    if (!bangSanPham) {
      bangSanPham =
        '<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:i/><w:sz w:val="26"/></w:rPr><w:t>Chưa có sản phẩm trên thuyết minh.</w:t></w:r></w:p>'
    }

    const stripHtml = (html: string | null | undefined) =>
      html ? String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''

    const data: Record<string, string> = {
      ngay_lap: ngayLap,
      ten_nhiem_vu: outline.title || '',
      ma_so_cap_quan_ly: [outline.code, outline.level].filter(Boolean).join(' — '),
      chu_nhiem: outline.ownerName || '',
      to_chuc_chu_tri: toChucChuTri,
      so_qd_hd: [soHd, ngayHd ? `ngày ${ngayHd}` : ''].filter(Boolean).join(' — '),
      thoi_gian_thuc_hien: `${start} → ${end}${giaHan}`.replace(/^ → | → $/g, ''),
      tong_kinh_phi: kinhPhi ? `${kinhPhi.toLocaleString('vi-VN')} đồng` : '',
      don_vi_phoi_hop: donViPhoiHop,
      tom_tat_ket_qua: '',
      tong_quan_van_de: '',
      muc_tieu_doi_tuong_pham_vi: stripHtml(outline.detailedObjectives),
      noi_dung_nghien_cuu: stripHtml(outline.researchContent),
      phuong_phap_nghien_cuu: stripHtml(outline.methodology),
      ket_qua_nghien_cuu: '',
      bang_san_pham: '',
      ghi_chu_san_pham: '',
      hieu_qua_ung_dung: '',
      ket_luan: '',
      kien_nghi: '',
      tai_lieu_tham_khao: '',
      phu_luc_minh_chung: '',
    }

    const safeCode = (outline.code || String(outline.id)).replace(/[^\w.-]/g, '_')
    const merged = await mergeDocxTemplate({
      templatePath,
      data,
      tableBlocks: {
        bang_san_pham: bangSanPham,
      },
      outputFileName: `BM0502_${safeCode}_${Date.now()}.docx`,
    })
    return {
      fileName: `BM-05.02_Bao_cao_tong_ket_${safeCode}.docx`,
      fullPath: merged.fullPath,
      fileUrl: merged.fileUrl,
    }
  }

  /**
   * Lưu / nộp hồ sơ đề nghị đánh giá KQNV (đơn BM-05.01 + báo cáo BM-05.02 + minh chứng KQDK).
   */
  static async saveEvaluationRequest(
    outlineId: number,
    userId: number,
    body: Record<string, unknown>,
    submit: boolean
  ) {
    const outline = await loadOutline(outlineId)
    assertReady(outline)
    await assertCnnv(userId, outline)
    const row = await this.ensure(outline.id)
    const allowed =
      !outline.executionStatus ||
      ['DANG_THUC_HIEN', 'DGCK_DRAFT', 'DGCK_BS'].includes(outline.executionStatus)
    if (!allowed) throw new Error('BAD_EXECUTION_STATUS')

    // Đơn đề nghị BM-05.01 đã ký / hoàn chỉnh
    row.summaryFile = parseOneFile(
      body.donFile ?? body.summaryFile ?? body.summary_file,
      FILE_LIMIT.summary
    )
    // Báo cáo tổng kết BM-05.02 hoàn chỉnh
    row.briefFile = parseOneFile(body.reportFile ?? body.briefFile ?? body.brief_file, FILE_LIMIT.brief)

    const rawProducts = Array.isArray(body.products) ? body.products : []
    row.products = rawProducts
      .map((item) => {
        const r = (item || {}) as Record<string, unknown>
        const name = String(r.name || r.title || '').trim()
        if (!name) return null
        return {
          name,
          fileUrl: String(r.fileUrl || r.file_url || '').trim() || null,
          link: String(r.link || '').trim() || null,
        } as FinalProduct
      })
      .filter((x): x is FinalProduct => !!x)

    const meta = {
      kind: 'EVALUATION_REQUEST',
      evidences: Array.isArray(body.evidences) ? body.evidences : [],
    }
    row.publicationsNote = JSON.stringify(meta)

    if (!outline.executionStatus || outline.executionStatus === 'DANG_THUC_HIEN') {
      outline.executionStatus = 'DGCK_DRAFT'
    }

    if (submit) {
      if (!row.products.length) throw new Error('DOSSIER_INCOMPLETE')
      const thieuMinhChung = row.products.some((p) => !p.fileUrl && !p.link)
      if (thieuMinhChung) throw new Error('DOSSIER_INCOMPLETE')
      row.submittedAt = DateTime.now()
      outline.executionStatus = 'DGCK_CHO_PKH'
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ đề nghị đánh giá KQNV',
        message: outline.code,
        link: await this.contractTabPath(outline.id, 'denghi'),
      })
    }

    await row.save()
    await outline.save()
    return this.show(outline.id, userId)
  }

  private static async writeProfiles(
    outline: Awaited<ReturnType<typeof loadOutline>>,
    classification: string | null
  ) {
    const members = await ProjectOutlineMember.query().where('project_outline_id', outline.id)
    const year = DateTime.now().year
    const budget = Number(outline.approvedBudget ?? outline.requestedBudget ?? 0)
    const targets: { profile: ScientificProfile; role: string }[] = []
    if (outline.ownerId) {
      const ownerProfile = await ScientificProfile.query().where('user_id', outline.ownerId).first()
      if (ownerProfile) targets.push({ profile: ownerProfile, role: 'Chủ nhiệm' })
    }
    for (const member of members) {
      if (!member.profileId) continue
      const profile = await ScientificProfile.find(member.profileId)
      if (!profile) continue
      if (targets.some((t) => t.profile.id === profile.id)) continue
      targets.push({ profile, role: member.role === 'PRINCIPAL' ? 'Chủ nhiệm' : 'Thành viên' })
    }
    const label = classification && classification in CLASSIFICATION_LABEL
      ? CLASSIFICATION_LABEL[classification as FinalClassification]
      : classification
    for (const target of targets) {
      const list = Array.isArray(target.profile.completedResearchTasks)
        ? [...target.profile.completedResearchTasks]
        : []
      if (list.some((item) => Number((item as { outlineId?: number }).outlineId) === outline.id)) continue
      list.push({
        outlineId: outline.id,
        code: outline.code,
        title: outline.title,
        role: target.role,
        year,
        classification: label,
        budget,
        completedAt: DateTime.now().toISO(),
      })
      target.profile.completedResearchTasks = list
      await target.profile.save()
    }
  }
}
