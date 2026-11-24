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
import ProjectContractService from '#services/project_contract_service'
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
  xmlBangTuDuLieu,
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
  ST_CHINH_SUA,
  ST_CHO_QUYET_TOAN,
  ST_KHONG_DAT,
  type BudgetLineCode,
  type CouncilRole,
  type FinalClassification,
} from '#constants/module56'
import { DATETIME_FORMAT } from '#constants/datetime_formats'
import { formatVndPlain, numberToVietnameseWords } from '#utils/vietnamese_number_words'
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
   * Hội đồng đánh giá của tôi — thành viên HĐ xem list nhiệm vụ được mời.
   */
  static async listMyEvalSheets(userId: number) {
    const laThanhVien = (c: ProjectFinalCase) =>
      (c.councilMembers || []).some(
        (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
      )
    const allCases = await ProjectFinalCase.query().orderBy('id', 'desc').limit(800)
    const mine = allCases.filter(laThanhVien)
    if (!mine.length) return []

    const outlineIds = mine.map((c) => c.projectOutlineId)
    const outlines = await ProjectOutline.query().whereIn('id', outlineIds)
    const byOutline = new Map(outlines.map((o) => [o.id, o]))
    const allSheets = await ProjectFinalSheet.query().whereIn('project_outline_id', outlineIds)
    const sheetsByOutline = new Map<number, ProjectFinalSheet[]>()
    for (const s of allSheets) {
      const arr = sheetsByOutline.get(s.projectOutlineId) || []
      arr.push(s)
      sheetsByOutline.set(s.projectOutlineId, arr)
    }
    const contracts = await ProjectContract.query().whereIn('project_outline_id', outlineIds)
    const contractByOutline = new Map(contracts.map((c) => [c.projectOutlineId, c]))

    const ketLuanNhan = (v: string | null | undefined) => {
      const x = String(v || '')
      if (x === 'DAT_YEU_CAU') return 'Đạt'
      if (x === 'CAN_BO_SUNG') return 'Cần bổ sung'
      if (x === 'KHONG_DAT') return 'Không đạt'
      return x || null
    }

    return mine
      .map((c) => {
        const outline = byOutline.get(c.projectOutlineId)
        if (!outline) return null
        const membersRaw = c.councilMembers || []
        const me = membersRaw.find(
          (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
        )
        const sheetList = sheetsByOutline.get(c.projectOutlineId) || []
        const sheetByUser = new Map(sheetList.map((s) => [Number(s.userId), s]))
        const mySheet = sheetByUser.get(Number(userId))
        const role = String((me as any)?.role || '')
        const members = membersRaw.map((m) => {
          const uid = Number((m as any).userId ?? (m as any).user_id)
          const r = String((m as any).role || '')
          const sh = sheetByUser.get(uid)
          return {
            userId: uid,
            fullName: String((m as any).fullName || (m as any).name || `#${uid}`),
            role: r || null,
            roleLabel: r
              ? COUNCIL_ROLE_LABEL[r as keyof typeof COUNCIL_ROLE_LABEL] || r
              : null,
            sheetStatus: sh?.submittedAt ? 'DA_NOP' : 'CHUA_NOP',
            submittedAt: iso(sh?.submittedAt || null),
            ketLuan: ketLuanNhan(sh?.reportComment),
          }
        })
        const memberCount = members.length
        const submittedCount = members.filter((m) => m.sheetStatus === 'DA_NOP').length
        const pendingCount = memberCount - submittedCount
        return {
          outlineId: outline.id,
          code: outline.code,
          title: outline.title,
          ownerName: outline.ownerName,
          ownerUnit: (outline as any).ownerUnit || null,
          executionStatus: outline.executionStatus,
          meetingAt: iso(c.meetingAt),
          location: c.meetingLocation,
          role: role || null,
          roleLabel: role
            ? COUNCIL_ROLE_LABEL[role as keyof typeof COUNCIL_ROLE_LABEL] || role
            : null,
          sheetSubmittedAt: iso(mySheet?.submittedAt || null),
          minutesLocked: !!c.minutesLocked,
          contractId: contractByOutline.get(c.projectOutlineId)?.id || null,
          memberCount,
          submittedCount,
          pendingCount,
          progressPercent: memberCount
            ? Math.round((submittedCount / memberCount) * 100)
            : 0,
          duPhieu: memberCount > 0 && pendingCount === 0,
          members,
          formPath: `/projects/final-eval/${outline.id}`,
          detailPath: `/projects/final-eval/my/${outline.id}`,
        }
      })
      .filter(Boolean)
  }

  /**
   * Tổng hợp phiếu ĐGCK — PKH (contract_manage) hoặc Thư ký HĐ.
   * Menu «Theo dõi phiếu ĐGCK».
   */
  static async listEvalSheetTracking(userId: number) {
    const isPkh = await hasPerm(userId, 'project.contract_manage')
    const allCases = await ProjectFinalCase.query().orderBy('id', 'desc').limit(800)
    const visible = allCases.filter((c) => {
      const members = c.councilMembers || []
      if (!members.length) return false
      if (isPkh) return true
      return members.some(
        (m) =>
          Number((m as any).userId ?? (m as any).user_id) === Number(userId) &&
          String((m as any).role || '') === 'THU_KY'
      )
    })
    if (!visible.length) return []

    const outlineIds = visible.map((c) => c.projectOutlineId)
    const outlines = await ProjectOutline.query().whereIn('id', outlineIds)
    const byOutline = new Map(outlines.map((o) => [o.id, o]))
    const sheets = await ProjectFinalSheet.query().whereIn('project_outline_id', outlineIds)
    const sheetsByOutline = new Map<number, ProjectFinalSheet[]>()
    for (const s of sheets) {
      const arr = sheetsByOutline.get(s.projectOutlineId) || []
      arr.push(s)
      sheetsByOutline.set(s.projectOutlineId, arr)
    }
    const contracts = await ProjectContract.query().whereIn('project_outline_id', outlineIds)
    const contractByOutline = new Map(contracts.map((c) => [c.projectOutlineId, c]))

    const ketLuanNhan = (v: string | null | undefined) => {
      const x = String(v || '')
      if (x === 'DAT_YEU_CAU') return 'Đạt'
      if (x === 'CAN_BO_SUNG') return 'Cần bổ sung'
      if (x === 'KHONG_DAT') return 'Không đạt'
      return x || null
    }

    return visible
      .map((c) => {
        const outline = byOutline.get(c.projectOutlineId)
        if (!outline) return null
        const membersRaw = c.councilMembers || []
        const sheetList = sheetsByOutline.get(c.projectOutlineId) || []
        const sheetByUser = new Map(sheetList.map((s) => [Number(s.userId), s]))
        const members = membersRaw.map((m) => {
          const uid = Number((m as any).userId ?? (m as any).user_id)
          const role = String((m as any).role || '')
          const sheet = sheetByUser.get(uid)
          const submitted = !!sheet?.submittedAt
          return {
            userId: uid,
            fullName: String((m as any).fullName || (m as any).name || `#${uid}`),
            email: (m as any).email || null,
            role: role || null,
            roleLabel: role
              ? COUNCIL_ROLE_LABEL[role as keyof typeof COUNCIL_ROLE_LABEL] || role
              : null,
            sheetStatus: submitted ? 'DA_NOP' : 'CHUA_NOP',
            submittedAt: iso(sheet?.submittedAt || null),
            ketLuan: ketLuanNhan(sheet?.reportComment),
            ketLuanCode: sheet?.reportComment || null,
            bcKetQua: sheet?.volumeComment || null,
          }
        })
        const memberCount = members.length
        const submittedCount = members.filter((m) => m.sheetStatus === 'DA_NOP').length
        const pendingCount = memberCount - submittedCount
        const me = membersRaw.find(
          (m) => Number((m as any).userId ?? (m as any).user_id) === Number(userId)
        )
        const myRole = String((me as any)?.role || '') || null
        return {
          outlineId: outline.id,
          code: outline.code,
          title: outline.title,
          ownerName: outline.ownerName,
          executionStatus: outline.executionStatus,
          meetingAt: iso(c.meetingAt),
          location: c.meetingLocation,
          minutesLocked: !!c.minutesLocked,
          contractId: contractByOutline.get(c.projectOutlineId)?.id || null,
          memberCount,
          submittedCount,
          pendingCount,
          progressPercent: memberCount
            ? Math.round((submittedCount / memberCount) * 100)
            : 0,
          duPhieu: memberCount > 0 && pendingCount === 0,
          myRole,
          isPkhViewer: isPkh,
          members,
          detailPath: `/projects/final-eval/tracking/${outline.id}`,
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
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    const members = row.councilMembers || []
    const isPkh = await hasPerm(userId, 'project.contract_manage')
    const isThuKy = members.some(
      (m) =>
        Number((m as any).userId ?? (m as any).user_id) === Number(userId) &&
        String((m as any).role || '') === 'THU_KY'
    )
    if (!isPkh && !isThuKy) throw new Error('FORBIDDEN')
    const member = members.find(
      (m) => Number((m as any).userId ?? (m as any).user_id) === Number(memberUserId)
    )
    if (!member) throw new Error('NOT_FOUND')
    await NotificationService.push(Number((member as any).userId), {
      type: 'PROJECT_UPDATE',
      title: 'Nhắc nộp phiếu đánh giá KQCK',
      message: `${outline.code}: vui lòng hoàn thành phiếu đánh giá kết quả cuối kỳ`,
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
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_HOP_HD'])
    const row = await this.ensure(outline.id)
    if (row.minutesLocked) throw new Error('MINUTES_LOCKED')
    const members = row.councilMembers || []
    const isPkh = await hasPerm(userId, 'project.contract_manage')
    const isThuKy = members.some(
      (m) =>
        Number((m as any).userId ?? (m as any).user_id) === Number(userId) &&
        String((m as any).role || '') === 'THU_KY'
    )
    if (!isPkh && !isThuKy) throw new Error('FORBIDDEN')
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
    const discussion = String(
      body.nhanXetChung ?? body.discussion ?? ''
    ).trim()
    const clarifyContent = String(
      body.clarifyContent ?? body.noiDungLamRo ?? body.quality ?? ''
    ).trim()
    const ownerExplanation = String(
      body.ownerExplanation ?? body.giaiTrinhYKien ?? ''
    ).trim()
    const noiDungHoanThien = String(
      body.noiDungHoanThien ?? body.recommendation ?? ''
    ).trim()
    const otherRecommendation = String(
      body.otherRecommendation ?? body.kienNghiKhac ?? ''
    ).trim()
    const recommendation = [noiDungHoanThien, otherRecommendation]
      .filter(Boolean)
      .join('\n')
    if (!discussion) throw new Error('MINUTES_INCOMPLETE')
    const voteDat = Number(body.voteDat ?? body.phieuDat ?? 0)
    const voteBoSung = Number(body.voteBoSung ?? body.phieuBoSung ?? 0)
    const voteKhongDat = Number(body.voteKhongDat ?? body.phieuKhongDat ?? 0)
    const voteEligible = Number(
      body.voteEligible ?? body.soQuyenBieuQuyet ?? present.length
    )
    const volume = `Đạt ${voteDat}; Bổ sung ${voteBoSung}; Không đạt ${voteKhongDat}`
    const quality = clarifyContent || discussion
    // Dòng giải trình BM-05.07 lấy từ 2.2 Nội dung cần làm rõ, hoàn thiện
    const tachDong = (raw: string) =>
      raw
        .split(/\r?\n/)
        .map((s) =>
          s
            .replace(/^\s*[-–—•]\s*/, '')
            .replace(/^\s*\d+[.)]\s*/, '')
            .trim()
        )
        .filter(Boolean)
    const linesClarify = tachDong(clarifyContent)
    const lines =
      linesClarify.length > 0
        ? linesClarify
        : tachDong(recommendation)
    const marksIn = Array.isArray(body.productMarks) ? body.productMarks : []
    const productMarks = (outline.expectedProducts || []).map((p) => {
      const hit = (marksIn as { name?: string; met?: boolean }[]).find((m) => m.name === p.name)
      return { name: p.name, met: !!hit?.met }
    })
    const absent = members.map((m) => m.userId).filter((id) => !present.includes(id))
    const nextAction = String(body.nextAction ?? body.xuLyTiepTheo ?? '').trim()
    const minutes: MinutesBody = {
      discussion,
      volume,
      quality,
      recommendation: recommendation || discussion,
      recommendationLines: lines.length ? lines : [recommendation || discussion],
      presentUserIds: present,
      absentUserIds: absent,
      productMarks,
      qdCouncilNo: String(body.qdCouncilNo ?? body.soQdHd ?? '').trim() || undefined,
      clarifyContent: clarifyContent || undefined,
      ownerExplanation: ownerExplanation || undefined,
      voteDat,
      voteBoSung,
      voteKhongDat,
      voteEligible,
      completeDeadline: String(body.completeDeadline ?? body.thoiHan ?? '').trim() || undefined,
      completeChecker:
        String(body.completeChecker ?? body.nguoiKiemTra ?? '').trim() || undefined,
      nextAction: nextAction || undefined,
      otherRecommendation: otherRecommendation || undefined,
    }

    const chuTich =
      members.find((m) => m.role === 'CHU_TICH')?.fullName ||
      members.find((m) => String((m as any).role) === 'CHU_TICH')?.fullName ||
      ''
    const thuKy =
      members.find((m) => m.role === 'THU_KY')?.fullName ||
      members.find((m) => String((m as any).role) === 'THU_KY')?.fullName ||
      ''
    const meetingAt = row.meetingAt
      ? row.meetingAt.toFormat(DATETIME_FORMAT)
      : ''
    const thoiGianDiaDiem = [meetingAt, row.meetingLocation].filter(Boolean).join(' — ')
    const ketLuanText =
      classification === 'DAT_YEU_CAU'
        ? '☑ Đạt     ☐ Cần bổ sung, hoàn thiện để đủ cơ sở kết luận     ☐ Không đạt'
        : classification === 'CAN_BO_SUNG'
          ? '☐ Đạt     ☑ Cần bổ sung, hoàn thiện để đủ cơ sở kết luận     ☐ Không đạt'
          : '☐ Đạt     ☐ Cần bổ sung, hoàn thiện để đủ cơ sở kết luận     ☑ Không đạt'
    const xuLyText =
      nextAction === 'DANH_GIA_LAI'
        ? '☐ Xác nhận hoàn thiện hồ sơ     ☑ Đề nghị đánh giá lại'
        : nextAction === 'XAC_NHAN_HOAN_THIEN'
          ? '☑ Xác nhận hoàn thiện hồ sơ     ☐ Đề nghị đánh giá lại'
          : '☐ Xác nhận hoàn thiện hồ sơ     ☐ Đề nghị đánh giá lại'

    const hopDong = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'desc')
      .first()
    const mergeData: Record<string, string> = {
      ten_nhiem_vu: outline.title || '',
      ma_so: outline.code || '',
      chu_nhiem: outline.ownerName || '',
      to_chuc_chu_tri: outline.hostUnit || outline.ownerUnit || '',
      so_qd_hd: minutes.qdCouncilNo || hopDong?.contractNo || '',
      thoi_gian_dia_diem: thoiGianDiaDiem,
      chu_tich: chuTich,
      thu_ky: thuKy,
      tong_tv: String(members.length),
      so_tham_du: String(present.length),
      nhan_xet_chung: discussion,
      noi_dung_lam_ro: clarifyContent,
      giai_trinh_y_kien: ownerExplanation,
      phieu_dat: String(voteDat),
      phieu_bo_sung: String(voteBoSung),
      phieu_khong_dat: String(voteKhongDat),
      so_quyen_bieu_quyet: String(voteEligible),
      ket_luan: ketLuanText,
      noi_dung_hoan_thien: noiDungHoanThien,
      thoi_han: minutes.completeDeadline || '',
      nguoi_kiem_tra: minutes.completeChecker || '',
      xu_ly_tiep_theo: xuLyText,
      kien_nghi_khac: otherRecommendation,
      dong_trong: '',
    }

    const safeCode = (outline.code || String(outline.id)).replace(/[^\w.-]/g, '_')
    let stored = `BM0506_${safeCode}_${Date.now()}.docx`
    let fileUrl = ''
    const template = await ContractTemplateService.getDefaultActive('BIEN_BAN_DGCK')
    if (template) {
      const templatePath = await findContractTemplateFilePath(template.storedFileName)
      if (templatePath) {
        const merged = await mergeDocxTemplate({
          templatePath,
          data: mergeData,
          outputFileName: stored,
        })
        stored = merged.storedFileName
        fileUrl = merged.fileUrl
      }
    }
    if (!fileUrl) {
      // Fallback nếu chưa seed mẫu
      const docBlocks = this.minuteBlocks(outline, row, minutes, classification, sheets)
      const buf = buildFormDocx('BIÊN BẢN ĐÁNH GIÁ KẾT QUẢ THỰC HIỆN NHIỆM VỤ', docBlocks)
      const dir = await resolveGeneratedContractDir()
      await fs.writeFile(`${dir}/${stored}`, buf)
      fileUrl = buildPublicGeneratedContractUrl(stored)
    }

    row.minutes = minutes
    row.minutesLocked = true
    row.classification = classification
    row.minutesFileName = `BM-05.06_Bien_ban_${safeCode}.docx`
    row.minutesStoredFileName = stored
    row.minutesFileUrl = fileUrl
    if (classification === 'DAT_YEU_CAU') {
      // Đạt yêu cầu, không cần chỉnh sửa → chờ quyết toán
      outline.executionStatus = 'NT_CHO_QUYETTOAN'
      row.settlementStatus = 'QT_DRAFT'
    } else if (classification === 'CAN_BO_SUNG') {
      // Có kiến nghị hoàn thiện BC → chỉnh sửa + thông báo CNNV
      outline.executionStatus = 'NT_CHINH_SUA'
      row.explanationStartedAt = DateTime.now()
      row.explanationDeadline = DateTime.now().plus({ days: 14 })
      row.explanationStatus = null
      row.remindedDay10 = false
      row.remindedDay13 = false
    } else {
      // Không đạt → chờ PKH&HTQT quyết hướng xử lý
      outline.executionStatus = 'NT_KHONG_DAT'
    }
    await row.save()
    await outline.save()

    const ketLuan = CLASSIFICATION_LABEL[classification]
    if (classification === 'DAT_YEU_CAU' && outline.ownerId) {
      const linkQt = await this.contractTabPath(outline.id, 'quyettoan')
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Đánh giá cuối kỳ: Đạt yêu cầu',
        message: `${outline.code}: chuyển bước quyết toán`,
        link: linkQt,
      })
    } else if (classification === 'CAN_BO_SUNG' && outline.ownerId) {
      const linkGt = await this.contractTabPath(outline.id, 'giaitrinh')
      const noiDung =
        minutes.recommendation ||
        minutes.clarifyContent ||
        minutes.otherRecommendation ||
        'Vui lòng hoàn thiện báo cáo / hồ sơ theo biên bản hội đồng.'
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Đánh giá cuối kỳ: Cần hoàn thiện báo cáo',
        message: `${outline.code}: ${noiDung}`,
        link: linkGt,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        `[KH&CN] Yêu cầu hoàn thiện sau đánh giá cuối kỳ — ${outline.code}`,
        [
          `Kính gửi ${outline.ownerName || 'Quý Thầy/Cô'},`,
          '',
          `Hội đồng đánh giá kết quả nhiệm vụ ${outline.code} — ${outline.title || ''}`,
          `đã kết luận: ${ketLuan}.`,
          '',
          'Nội dung cần hoàn thiện:',
          noiDung,
          '',
          'Vui lòng đăng nhập hệ thống để bổ sung / giải trình:',
          linkGt,
          '',
          'Trân trọng,',
          'Hệ thống Quản lý Khoa học và Công nghệ',
        ].join('\n'),
        'project_final_minutes_chinh_sua',
        row.id
      )
    } else if (classification === 'KHONG_DAT') {
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Đánh giá cuối kỳ: Không đạt',
          message: `${outline.code}: chờ Phòng KH&HTQT quyết định hướng xử lý`,
          link: await this.contractTabPath(outline.id, 'danhgia'),
        })
      }
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'ĐGCK Không đạt — cần PKH quyết định',
        message: `${outline.code}: chọn cho làm lại hoặc đình chỉ`,
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
    assertExecution(outline, [...ST_KHONG_DAT])
    const row = await this.ensure(outline.id)
    if (retry) {
      outline.executionStatus = 'NT_CHINH_SUA'
      row.explanationStartedAt = DateTime.now()
      row.explanationDeadline = DateTime.now().plus({ days: 14 })
      row.remindedDay10 = false
      row.remindedDay13 = false
    } else {
      outline.executionStatus = 'DGCK_DINH_CHI'
    }
    await row.save()
    await outline.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: retry
          ? 'PKH cho phép hoàn thiện sau đánh giá Không đạt'
          : 'Nhiệm vụ bị đình chỉ sau đánh giá Không đạt',
        message: outline.code,
        link: await this.contractTabPath(
          outline.id,
          retry ? 'giaitrinh' : 'danhgia'
        ),
      })
    }
    return this.show(outline.id, userId)
  }

  static async saveExplanation(outlineId: number, userId: number, body: Record<string, unknown>, submit: boolean) {
    const outline = await loadOutline(outlineId)
    await assertCnnv(userId, outline)
    assertExecution(outline, [...ST_CHINH_SUA])
    const row = await this.ensure(outline.id)
    if (row.explanationStatus && row.explanationStatus !== 'TRA_LAI') throw new Error('BAD_STATUS')
    const input = Array.isArray(body.items)
      ? (body.items as {
          recommendation?: string
          response?: string
          evidence?: string
          evidenceFile?: unknown
          text?: string
        }[])
      : []
    if (!input.length) throw new Error('EXPLANATION_MISMATCH')
    const items: ExplanationItem[] = input.map((it) => {
      const evidenceFile = parseOneFile(it.evidenceFile, FILE_LIMIT.summary)
      return {
        recommendation: String(it.recommendation || it.text || '').trim(),
        response: String(it.response || '').trim(),
        evidence: String(it.evidence || '').trim() || undefined,
        evidenceFile: evidenceFile || null,
      }
    })
    if (submit && items.some((it) => !it.recommendation || !it.response)) {
      throw new Error('EXPLANATION_MISMATCH')
    }
    // Mỗi dòng cần mô tả minh chứng hoặc file đính kèm
    if (submit && items.some((it) => !it.evidence?.trim() && !it.evidenceFile)) {
      throw new Error('EXPLANATION_MISMATCH')
    }
    row.explanationItems = items
    // Báo cáo tổng kết đính kèm hồ sơ giải trình
    row.explanationReportFile = parseOneFile(body.reportFile ?? body.report_file, FILE_LIMIT.summary)
    if (submit) {
      if (!row.explanationReportFile) throw new Error('FILE_REQUIRED')
      row.explanationStatus = 'CHO_THU_KY'
      row.explanationReturnReason = null
      row.secretaryConfirmedAt = null
      row.chairConfirmedAt = null
      // Thành viên HĐ → link Hội đồng của tôi (không vào menu NT cần quyền PKH)
      const linkHd = this.councilMyPath(outline.id, 'giaitrinh')
      const secretary = (row.councilMembers || []).find((m) => m.role === 'THU_KY')
      const chair = (row.councilMembers || []).find((m) => m.role === 'CHU_TICH')
      // Thông báo Thư ký HĐ + Chủ tịch HĐ ĐGCK
      for (const tv of [secretary, chair]) {
        if (!tv) continue
        const laThuKy = tv.role === 'THU_KY'
        await NotificationService.push(tv.userId, {
          type: 'PROJECT_UPDATE',
          title: laThuKy
            ? 'Bản giải trình chờ thư ký xác nhận'
            : 'CNNV đã nộp bản giải trình — chờ thư ký rồi tới Chủ tịch',
          message: `${outline.code} — ${outline.title || ''}`.trim(),
          link: linkHd,
        })
        await EmailLogService.logStubToUser(
          tv.userId,
          laThuKy
            ? 'Bản giải trình chờ thư ký xác nhận'
            : 'CNNV đã nộp bản giải trình',
          `Nhiệm vụ ${outline.code}`,
          'final_case',
          outline.id
        )
      }
    }
    await row.save()
    return this.show(outline.id, userId)
  }

  static async confirmExplanation(outlineId: number, userId: number, accept: boolean, reason: string) {
    const outline = await loadOutline(outlineId)
    assertExecution(outline, [...ST_CHINH_SUA])
    const row = await this.ensure(outline.id)
    const secretary = (row.councilMembers || []).find((m) => m.role === 'THU_KY')
    const chair = (row.councilMembers || []).find((m) => m.role === 'CHU_TICH')
    const linkHd = this.councilMyPath(outline.id, 'giaitrinh')
    if (row.explanationStatus === 'CHO_THU_KY') {
      if (!secretary || secretary.userId !== userId) throw new Error('FORBIDDEN')
      if (!accept) return this.returnExplanation(row, outline, reason, userId)
      row.secretaryConfirmedAt = DateTime.now()
      row.explanationStatus = 'CHO_CHU_TICH'
      await row.save()
      if (chair) {
        await NotificationService.push(chair.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Bản giải trình chờ Chủ tịch HĐ xác nhận',
          message: `${outline.code} — Thư ký đã xác nhận, vui lòng xem bảng giải trình và báo cáo tổng kết.`,
          link: linkHd,
        })
        await EmailLogService.logStubToUser(
          chair.userId,
          'Bản giải trình chờ Chủ tịch HĐ xác nhận',
          `Nhiệm vụ ${outline.code}`,
          'final_case',
          outline.id
        )
      }
    } else if (row.explanationStatus === 'CHO_CHU_TICH') {
      if (!chair || chair.userId !== userId) throw new Error('FORBIDDEN')
      if (!accept) return this.returnExplanation(row, outline, reason, userId)
      row.chairConfirmedAt = DateTime.now()
      row.explanationStatus = 'XONG'
      // Chuyển chờ quyết toán (NT_*) — PKH tiếp tục QT/TL
      outline.executionStatus = 'NT_CHO_QUYETTOAN'
      row.settlementStatus = row.settlementStatus || 'QT_DRAFT'
      await row.save()
      await outline.save()
      const linkQt = await this.contractTabPath(outline.id, 'quyettoan')
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Giải trình đã được Chủ tịch xác nhận — chờ quyết toán',
        message: `${outline.code} — ${outline.title || ''}`.trim(),
        link: linkQt,
      })
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Chủ tịch đã xác nhận bản giải trình',
          message: 'Hồ sơ chuyển sang chờ quyết toán.',
          link: linkQt,
        })
      }
    } else {
      throw new Error('BAD_STATUS')
    }
    return this.show(outline.id, userId)
  }

  static async extendExplanation(outlineId: number, userId: number, deadline: string) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, [...ST_CHINH_SUA])
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
    assertExecution(outline, [...ST_CHO_QUYET_TOAN])
    const row = await this.ensure(outline.id)
    if (row.settlementStatus && !['QT_DRAFT', 'QT_BS'].includes(row.settlementStatus)) {
      throw new Error('BAD_STATUS')
    }
    const input = Array.isArray(body.lines)
      ? (body.lines as {
          code: string
          declaredAmount?: number
          declared_amount?: number
          evidenceFiles?: unknown
          evidence_files?: unknown
        }[])
      : []
    const map = new Map<string, { amount: number; evidenceFiles: ReturnType<typeof parseFiles> }>()
    for (const line of input) {
      if (!BUDGET_LINE_CODES.includes(line.code as BudgetLineCode)) throw new Error('INVALID_BUDGET_CODE')
      const amount = money(line.declaredAmount ?? line.declared_amount)
      const evidenceFiles = parseFiles(line.evidenceFiles ?? line.evidence_files ?? [], {
        required: false,
      })
      map.set(line.code, { amount, evidenceFiles })
    }
    if (map.size !== BUDGET_LINE_CODES.length) throw new Error('BUDGET_LINES_INCOMPLETE')
    row.settlementLines = BUDGET_LINE_CODES.map((code) => {
      const hit = map.get(code)
      return {
        code,
        declaredAmount: hit?.amount || 0,
        evidenceFiles: hit?.evidenceFiles || [],
      }
    })
    // files = bảng quyết toán tổng hợp (Excel/PDF) — không lẫn chứng từ theo dòng
    row.settlementFiles = parseFiles(body.files ?? body.attachments, { required: false })
    if (submit) {
      if (!row.settlementFiles.length) throw new Error('SETTLEMENT_SUMMARY_REQUIRED')
      const thieuChungTu = row.settlementLines.some(
        (l) => Number(l.declaredAmount) > 0 && !(l.evidenceFiles || []).length
      )
      if (thieuChungTu) throw new Error('SETTLEMENT_EVIDENCE_REQUIRED')
    }
    row.varianceAck = false
    row.varianceReason = null
    if (submit) {
      row.settlementStatus = 'QT_CHO_PKH'
      row.settlementReturnReason = null
      const linkQt = await this.contractTabPath(outline.id, 'quyettoan')
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'Hồ sơ quyết toán chờ PKH&HTQT kiểm tra',
        message: `${outline.code} — ${outline.title || ''}`.trim(),
        link: linkQt,
      })
    } else {
      row.settlementStatus = 'QT_DRAFT'
    }
    await row.save()
    return this.show(outline.id, userId)
  }

  static async pkhSettlement(outlineId: number, userId: number, accept: boolean, note: string) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    if (row.settlementStatus !== 'QT_CHO_PKH') throw new Error('BAD_STATUS')
    const linkQt = await this.contractTabPath(outline.id, 'quyettoan')
    if (!accept) {
      if (!note.trim()) throw new Error('REASON_REQUIRED')
      row.settlementStatus = 'QT_BS'
      row.settlementReturnReason = note.trim()
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Hồ sơ quyết toán cần bổ sung',
          message: note.trim(),
          link: linkQt,
        })
      }
    } else {
      row.settlementStatus = 'QT_CHO_TC'
      row.settlementReturnReason = null
      await NotificationService.pushToPermission('project.budget_confirm', {
        type: 'PROJECT_UPDATE',
        title: 'Quyết toán chờ KH-TC thẩm định',
        message: `${outline.code} — ${outline.title || ''}`.trim(),
        link: linkQt,
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
    assertExecution(outline, [...ST_CHO_QUYET_TOAN])
    const row = await this.ensure(outline.id)
    if (row.settlementStatus !== 'QT_CHO_TC') throw new Error('BAD_STATUS')
    const linkQt = await this.contractTabPath(outline.id, 'quyettoan')
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.settlementStatus = 'QT_BS'
      row.settlementReturnReason = reason.trim()
      await row.save()
      if (outline.ownerId) {
        await NotificationService.push(outline.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'KH-TC yêu cầu bổ sung hồ sơ quyết toán',
          message: reason.trim(),
          link: linkQt,
        })
      }
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
    const linkTl = await this.contractTabPath(outline.id, 'thanhly')
    await NotificationService.pushToPermission('project.contract_manage', {
      type: 'PROJECT_UPDATE',
      title: 'Đã quyết toán — chờ thanh lý hợp đồng',
      message: `${outline.code} — ${outline.title || ''}`.trim(),
      link: linkTl,
    })
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'KH-TC đã xác nhận quyết toán',
        message: 'Hồ sơ chuyển sang chờ thanh lý.',
        link: linkTl,
      })
    }
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
    row.liquidationReturnReason = null
    // Sinh / cập nhật dự thảo BM-05.10 để PKH xem trước trước khi trình BGH
    await this.writeLiquidationFile(outline, row)
    await row.save()
    return this.show(outline.id, userId)
  }

  static async submitLiquidation(outlineId: number, userId: number) {
    await assertPerm(userId, 'project.contract_manage')
    const outline = await loadOutline(outlineId)
    assertExecution(outline, ['DGCK_CHO_THANH_LY'])
    const row = await this.ensure(outline.id)
    if (!row.surplusHandling) throw new Error('SURPLUS_REQUIRED')
    if (
      row.liquidationStatus &&
      !['TL_DRAFT', 'TL_TRA_LAI'].includes(row.liquidationStatus)
    ) {
      throw new Error('BAD_STATUS')
    }
    await this.writeLiquidationFile(outline, row)
    row.liquidationStatus = 'TL_CHO_BGH'
    row.liquidationReturnReason = null
    await row.save()
    await NotificationService.pushToPermission('project.outline_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Biên bản thanh lý chờ BGH ký',
      message: `${outline.code} — ${outline.title || ''}`.trim(),
      link: await this.contractTabPath(outline.id, 'thanhly'),
    })
    return this.show(outline.id, userId)
  }

  static async bghLiquidation(outlineId: number, userId: number, accept: boolean, reason: string) {
    await assertPerm(userId, 'project.outline_approve')
    const outline = await loadOutline(outlineId)
    const row = await this.ensure(outline.id)
    if (row.liquidationStatus !== 'TL_CHO_BGH') throw new Error('BAD_STATUS')
    const linkTl = await this.contractTabPath(outline.id, 'thanhly')
    if (!accept) {
      if (!reason.trim()) throw new Error('REASON_REQUIRED')
      row.liquidationStatus = 'TL_DRAFT'
      row.liquidationReturnReason = reason.trim()
      await row.save()
      await NotificationService.pushToPermission('project.contract_manage', {
        type: 'PROJECT_UPDATE',
        title: 'BGH trả lại biên bản thanh lý',
        message: reason.trim(),
        link: linkTl,
      })
      return this.show(outline.id, userId)
    }
    row.liqBghSignedAt = DateTime.now()
    row.liquidationStatus = 'TL_CHO_PHAT_HANH'
    row.liquidationReturnReason = null
    await row.save()
    await NotificationService.pushToPermission('project.contract_publish', {
      type: 'PROJECT_UPDATE',
      title: 'Thanh lý chờ TC-HC phát hành',
      message: `${outline.code} — ${outline.title || ''}`.trim(),
      link: linkTl,
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
    // Cập nhật lại file với số biên bản phát hành
    await this.writeLiquidationFile(outline, row)
    await row.save()
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Biên bản thanh lý chờ CNNV xác nhận',
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
      if (
        !ST_CHINH_SUA.includes(outline.executionStatus as (typeof ST_CHINH_SUA)[number]) ||
        !outline.ownerId
      ) {
        continue
      }
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
    const linkGt = await this.contractTabPath(outline.id, 'giaitrinh')
    if (outline.ownerId) {
      await NotificationService.push(outline.ownerId, {
        type: 'PROJECT_UPDATE',
        title: 'Bản giải trình chưa đạt — cần chỉnh sửa thêm',
        message: reason.trim(),
        link: linkGt,
      })
      await EmailLogService.logStubToUser(
        outline.ownerId,
        'Bản giải trình chưa đạt — cần chỉnh sửa thêm',
        reason.trim(),
        'final_case',
        outline.id
      )
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

  /** Link FE — tab nghiệm thu/thanh lý sang menu mới; còn lại giữ HĐ. */
  private static async contractTabPath(outlineId: number, tab = 'denghi') {
    const contract = await ProjectContract.query().where('project_outline_id', outlineId).first()
    if (contract) {
      const ntTabs = new Set([
        'denghi',
        'hoidong',
        'danhgia',
        'giaitrinh',
        'quyettoan',
        'thanhly',
      ])
      // Tab cũ «nghiemthu» → đề nghị ĐGKQNV
      const tabNt = tab === 'nghiemthu' ? 'denghi' : tab
      if (ntTabs.has(tabNt)) {
        return `/projects/nghiem-thu-thanh-ly/${contract.id}?tab=${tabNt}`
      }
      return `/projects/contracts/${contract.id}?tab=${tab}`
    }
    return `/projects/execution/${outlineId}`
  }

  /**
   * Link dành thành viên HĐ (Thư ký / Chủ tịch…) —
   * họ không có quyền menu Nghiệm thu/thanh lý, vào «Hội đồng đánh giá của tôi».
   */
  private static councilMyPath(outlineId: number, focus = 'giaitrinh') {
    return `/projects/final-eval/my/${outlineId}?focus=${encodeURIComponent(focus)}`
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
      ownerName: outline.ownerName || null,
      executionStatus: outline.executionStatus,
      /** Dùng form phiếu đánh giá KQCK (thành viên HĐ không gọi được getOutline) */
      expectedResults: outline.expectedResults || null,
      overdueExplanation: !!(
        row.explanationDeadline &&
        ST_CHINH_SUA.includes(outline.executionStatus as (typeof ST_CHINH_SUA)[number]) &&
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
        returnReason: row.liquidationReturnReason,
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
    const planned = finance.reduce((s, l) => s + l.planned, 0)
    const advanced = finance.reduce((s, l) => s + l.advanced, 0)
    const spent = finance.reduce((s, l) => s + l.spent, 0)
    const settled = finance.reduce((s, l) => s + l.settled, 0)
    const ton = Math.max(0, advanced - settled)
    const soThanhToanBs = Math.max(0, settled - advanced)
    // Chọn hoàn trả → ghi số tồn; không phát sinh → 0
    const soHoanTra = row.surplusHandling === 'HOAN_TRA' ? ton : 0
    const assets = await ProjectAsset.query().where('project_outline_id', outline.id)
    const hopDong = await ProjectContract.query()
      .where('project_outline_id', outline.id)
      .orderBy('id', 'desc')
      .first()
    const mp = hopDong?.mergePayload || {}
    const contact = await ProjectContractService.resolveOwnerContact(outline)
    const now = DateTime.now()
    const ngayLap = `ngày ${now.toFormat('dd')} tháng ${now.toFormat('MM')} năm ${now.toFormat('yyyy')}`
    const start = outline.startDate
    const end = outline.endDate
    let months = ''
    if (start && end) {
      months = String(Math.max(1, Math.round(end.diff(start, 'months').months)))
    }
    const kpTheoHd = Number(outline.approvedBudget ?? outline.confirmedBudget ?? planned) || planned
    const xepLoai = row.classification ? CLASSIFICATION_LABEL[row.classification] : ''
    const ngayHopHd = row.meetingAt?.toFormat('dd/MM/yyyy') || ''

    const data: Record<string, string> = {
      ngay_ap_dung: now.toFormat('dd/MM/yyyy'),
      loai_hinh: outline.level || mp.loai_hinh || '',
      so_bien_ban: row.liqIssueNo || '',
      ngay_lap: ngayLap,

      so_hop_dong: hopDong?.contractNo || mp.so_hop_dong || '',
      ngay_ky_hd:
        hopDong?.effectiveAt?.toFormat('dd/MM/yyyy') ||
        hopDong?.publishedAt?.toFormat('dd/MM/yyyy') ||
        mp.ngay_ky ||
        '',
      so_qd_cong_nhan: mp.so_qd_cong_nhan || '',
      ngay_qd_cong_nhan: mp.ngay_qd_cong_nhan || '',
      ngay_hop_hd: ngayHopHd,
      ngay_bb_xac_nhan: ngayHopHd,

      dia_chi_ben_b: mp.dia_chi_ben_b || contact.address || outline.hostUnit || '',
      dien_thoai_ben_b: mp.dien_thoai_ben_b || contact.phone || '',
      email_ben_b: mp.email_ben_b || contact.email || '',
      tai_khoan_ben_b: mp.tai_khoan_ben_b || '',
      ngan_hang_ben_b: mp.ngan_hang_ben_b || '',
      dai_dien_ben_b: mp.dai_dien_ben_b || outline.ownerName || '',
      chuc_vu_ben_b: mp.chuc_vu_ben_b || 'Chủ nhiệm nhiệm vụ',
      uy_quyen_ben_b: mp.uy_quyen_ben_b || '',

      chu_nhiem: outline.ownerName || mp.chu_nhiem || '',
      chuc_vu_chu_nhiem: mp.chuc_vu_chu_nhiem || 'Chủ nhiệm nhiệm vụ',
      don_vi_chu_nhiem: outline.ownerUnit || mp.don_vi_chu_nhiem || '',
      dien_thoai_chu_nhiem: contact.phone || mp.dien_thoai_chu_nhiem || '',
      email_chu_nhiem: contact.email || outline.ownerEmail || mp.email_chu_nhiem || '',

      ten_nhiem_vu: outline.title || '',
      ma_nhiem_vu: outline.code || '',
      cap_quan_ly: outline.level || '',
      thoi_gian_tu: start?.toFormat('dd/MM/yyyy') || '',
      thoi_gian_den: end?.toFormat('dd/MM/yyyy') || '',
      thoi_gian_thang: months,
      gia_han_den: Number(outline.extensionCount || 0) > 0 ? end?.toFormat('dd/MM/yyyy') || '' : '',
      so_qd_gia_han: Number(outline.extensionCount || 0) > 0 ? String(outline.extensionCount) : '',
      xep_loai: xepLoai,

      kp_theo_hd: formatVndPlain(kpTheoHd),
      kp_giao_khoan: formatVndPlain(kpTheoHd),
      kp_khong_khoan: formatVndPlain(0),
      nguon_truong: formatVndPlain(kpTheoHd),
      nguon_doi_ung: formatVndPlain(0),
      tong_nguon: formatVndPlain(kpTheoHd),
      tam_ung_dot_1: formatVndPlain(advanced),
      tam_ung_dot_2: formatVndPlain(0),
      tam_ung_luy_ke: formatVndPlain(advanced),
      gia_tri_quyet_toan: formatVndPlain(settled),
      thanh_toan_bo_sung: formatVndPlain(soThanhToanBs),
      thanh_toan_bo_sung_chu: soThanhToanBs
        ? numberToVietnameseWords(soThanhToanBs)
        : 'Không phát sinh',
      hoan_tra: formatVndPlain(soHoanTra),
      hoan_tra_chu: soHoanTra ? numberToVietnameseWords(soHoanTra) : 'Không phát sinh',
      han_thanh_toan: '',

      // Alias mẫu cũ
      kinh_phi_da_cap: formatVndPlain(advanced + spent),
      kinh_phi_quyet_toan: formatVndPlain(settled),
      ton: formatVndPlain(ton),
      xu_ly_ton: row.surplusHandling === 'HOAN_TRA' ? 'Hoàn trả' : 'Không phát sinh',
      ngay_quyet_toan: row.settlementDate?.toFormat('dd/MM/yyyy') || '',
      tai_san: assets.map((a) => `${a.name} (${a.quantity || ''})`).join('; '),
    }
    const template = await ContractTemplateService.getDefaultActive('THANH_LY')
    if (template) {
      const templatePath = await findContractTemplateFilePath(template.storedFileName)
      if (templatePath) {
        try {
          const safeCode = (outline.code || String(outline.id)).replace(/[^\w.-]/g, '_')
          const merged = await mergeDocxTemplate({
            templatePath,
            data,
            outputFileName: `BM0510_${safeCode}_${Date.now()}.docx`,
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
    const buf = buildFormDocx('BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG', [
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
    const stored = `BM0510_${outline.code}_${Date.now()}.docx`.replace(/[^\w.-]/g, '_')
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
   * Xuất DOCX bản giải trình tiếp thu (BM-05.07) từ mẫu BAN_GIAI_TRINH.
   */
  static async exportBanGiaiTrinh(outlineId: number, userId: number) {
    const outline = await loadOutline(outlineId)
    await this.assertSee(userId, outline)
    const template = await ContractTemplateService.getDefaultActive('BAN_GIAI_TRINH')
    if (!template) throw new Error('NO_DEFAULT_TEMPLATE')
    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) throw new Error('TEMPLATE_FILE_MISSING')

    const row = await this.ensure(outline.id)
    const now = DateTime.now()
    const ngayLap = `ngày ${now.toFormat('dd')} tháng ${now.toFormat('MM')} năm ${now.toFormat('yyyy')}`
    const ngayDanhGia = row.meetingAt
      ? row.meetingAt.toFormat('dd/MM/yyyy')
      : ''
    const chuTich = (row.councilMembers || []).find((m) => m.role === 'CHU_TICH')
    const tenHoiDong =
      chuTich?.fullName
        ? `Hội đồng đánh giá (Chủ tịch: ${chuTich.fullName})`
        : 'Hội đồng đánh giá kết quả nhiệm vụ'

    const saved = row.explanationItems || []
    const tachDong = (raw: string) =>
      raw
        .split(/\r?\n/)
        .map((s) =>
          s
            .replace(/^\s*[-–—•]\s*/, '')
            .replace(/^\s*\d+[.)]\s*/, '')
            .trim()
        )
        .filter(Boolean)
    // Giống màn xem biên bản: clarifyContent || quality
    const nguonYKien =
      row.minutes?.clarifyContent ||
      row.minutes?.quality ||
      (row.minutes?.recommendationLines || []).join('\n') ||
      row.minutes?.recommendation ||
      ''
    const lines =
      saved.some((it) => (it.recommendation || '').trim() || (it.response || '').trim())
        ? saved.map((it) => ({
            yKien: it.recommendation || '',
            tiepThu: it.response || '',
            minhChung: [it.evidence, it.evidenceFile?.fileName]
              .filter(Boolean)
              .join(' — '),
          }))
        : tachDong(nguonYKien).map((t) => ({
            yKien: t,
            tiepThu: '',
            minhChung: '',
          }))

    const bangNoiDung = xmlBangTuDuLieu({
      headers: [
        'STT',
        'Ý kiến/yêu cầu đánh giá',
        'Nội dung tiếp thu, giải trình hoặc hoàn thiện',
        'Vị trí/tài liệu minh chứng',
      ],
      rows: lines.length
        ? lines.map((it, i) => [
            String(i + 1),
            it.yKien,
            it.tiepThu,
            it.minhChung,
          ])
        : [],
      colWidths: [700, 2800, 3800, 2200],
      emptyText: 'Chưa có nội dung giải trình.',
      centerCols: [0],
      coChu: 24,
    })

    const data: Record<string, string> = {
      ngay_lap: ngayLap,
      ten_nhiem_vu: outline.title || '',
      ma_so: outline.code || '',
      chu_nhiem: outline.ownerName || '',
      ngay_danh_gia: ngayDanhGia,
      ten_hoi_dong: tenHoiDong,
      bang_noi_dung: '',
    }

    const safeCode = (outline.code || String(outline.id)).replace(/[^\w.-]/g, '_')
    const merged = await mergeDocxTemplate({
      templatePath,
      data,
      tableBlocks: {
        bang_noi_dung: bangNoiDung,
      },
      outputFileName: `BM0507_${safeCode}_${Date.now()}.docx`,
    })
    return {
      fileName: `BM-05.07_Ban_giai_trinh_${safeCode}.docx`,
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
