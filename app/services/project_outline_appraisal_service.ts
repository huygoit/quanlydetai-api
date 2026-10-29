import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import type { DefenseMeetingMode } from '#models/project_outline_defense_session'
import ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import type { DefenseCouncilRole } from '#models/project_outline_defense_member'
import ProjectOutlineDefenseSessionOutline from '#models/project_outline_defense_session_outline'
import ProjectOutlineDefenseScoreSheet from '#models/project_outline_defense_score_sheet'
import type { DefenseScoreLine } from '#models/project_outline_defense_score_sheet'
import NotificationService from '#services/notification_service'
import EmailLogService from '#services/email_log_service'
import ProjectOutlineService from '#services/project_outline_service'
import ProjectOutlineDefenseService from '#services/project_outline_defense_service'
import ContractTemplateService from '#services/contract_template_service'
import { BM05A_CRITERIA } from '#constants/bm05a_criteria'
import { chuanCauHinhQuyetDinh } from '#constants/quyet_dinh_template_variables'
import { findContractTemplateFilePath } from '#utils/contract_template_storage'
import { mergeDocxTemplate } from '#utils/docx_merge_helper'
import { DATETIME_FORMAT } from '#constants/datetime_formats'

type MemberInput = {
  userId?: number | null
  scientificProfileId?: number | null
  memberName: string
  memberEmail?: string | null
  roleInCouncil: DefenseCouncilRole
  isExternal?: boolean
  unit?: string | null
  proposedSourceNote?: string | null
}

const ACTIVE_STATUSES = ['DRAFT', 'PENDING_BGH', 'BGH_SIGNED', 'PUBLISHED', 'CONFIRMED'] as const

/**
 * Flow Tổ chức thẩm định (6 bước):
 * DRAFT → PENDING_BGH → BGH_SIGNED → PUBLISHED (+ BM.05a) → FINALIZED
 */
export default class ProjectOutlineAppraisalService {
  static emptyBm05aScores(): DefenseScoreLine[] {
    return BM05A_CRITERIA.map((c) => ({
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      score: null,
    }))
  }

  static async loadOutlines(sessionId: number) {
    const links = await ProjectOutlineDefenseSessionOutline.query()
      .where('session_id', sessionId)
      .orderBy('sort_order', 'asc')
    const ids = links.map((l) => l.projectOutlineId)
    if (!ids.length) return [] as ProjectOutline[]
    const rows = await ProjectOutline.query().whereIn('id', ids)
    const map = new Map(rows.map((r) => [r.id, r]))
    return ids.map((id) => map.get(id)!).filter(Boolean)
  }

  static serializeScoreSheet(s: ProjectOutlineDefenseScoreSheet) {
    return {
      id: s.id,
      sessionId: s.sessionId,
      memberId: s.memberId,
      projectOutlineId: s.projectOutlineId,
      status: s.status,
      precheckEligible: s.precheckEligible,
      precheckConflictCleared: s.precheckConflictCleared,
      precheckEthicsOk: s.precheckEthicsOk,
      scores: s.scoresJson || [],
      totalScore: s.totalScore == null ? null : Number(s.totalScore),
      conclusion: s.conclusion,
      generalComment: s.generalComment,
      submittedAt: s.submittedAt?.toISO() ?? null,
      remindedAt: s.remindedAt?.toISO() ?? null,
    }
  }

  static async serializeFull(session: ProjectOutlineDefenseSession) {
    await session.load('members')
    const outlines = await this.loadOutlines(session.id)
    const sheets = await ProjectOutlineDefenseScoreSheet.query().where('session_id', session.id)
    const base = ProjectOutlineDefenseService.serializeSession(
      session,
      session.members,
      outlines[0] || null
    )

    // Dựng lại HTML theo mẫu QĐ đầy đủ (không dùng stub cũ trong DB)
    let decisionDraftHtml = session.decisionDraftHtml
    let decisionFileUrl = session.decisionFileUrl
    if (session.decisionCode && session.members?.length && outlines.length) {
      try {
        const mergeData = await this.buildDecisionMergeData(session, outlines, session.members)
        decisionDraftHtml = this.buildDecisionHtml(session, outlines, session.members, mergeData)
        // Cập nhật HTML đã lưu nếu còn bản sơ sài cũ
        const canCuCu =
          !session.decisionDraftHtml ||
          session.decisionDraftHtml.includes('Chờ BGH ký số') ||
          !session.decisionDraftHtml.includes('Điều 1. Thành lập Hội đồng')
        if (canCuCu || !session.decisionFileUrl) {
          try {
            const docx = await this.renderDecisionDocx(
              session,
              outlines,
              session.members,
              mergeData
            )
            if (docx) decisionFileUrl = docx.fileUrl
          } catch {
            // bỏ qua lỗi merge DOCX
          }
          session.decisionDraftHtml = decisionDraftHtml
          session.decisionFileUrl = decisionFileUrl
          await session.save()
        }
      } catch {
        // giữ HTML đã lưu nếu dựng lại lỗi
      }
    }

    return {
      ...base,
      title: session.title,
      decisionDraftHtml,
      decisionCode: session.decisionCode,
      decisionFileUrl,
      submittedToBghAt: session.submittedToBghAt?.toISO() ?? null,
      bghSignedAt: session.bghSignedAt?.toISO() ?? null,
      bghSignNote: session.bghSignNote,
      publishedAt: session.publishedAt?.toISO() ?? null,
      earlyMeetingOpened: !!session.earlyMeetingOpened,
      earlyMeetingOpenedAt: session.earlyMeetingOpenedAt?.toISO() ?? null,
      outlines: outlines.map((o) => ({
        id: o.id,
        code: o.code,
        title: o.title,
        status: o.status,
        ownerName: o.ownerName,
        ownerUnit: o.ownerUnit,
        field: o.field,
      })),
      scoreSheets: sheets.map((s) => this.serializeScoreSheet(s)),
      scoreProgress: {
        total: sheets.length,
        submitted: sheets.filter((s) => s.status === 'SUBMITTED').length,
        draft: sheets.filter((s) => s.status === 'DRAFT').length,
      },
    }
  }

  /** TM chờ PKH nhóm vào phiên — không phụ thuộc đủ phiếu PB kín */
  static async listEligible() {
    const activeSessions = await ProjectOutlineDefenseSession.query().whereIn('status', [
      ...ACTIVE_STATUSES,
    ])
    const activeIds = activeSessions.map((s) => s.id)
    const busy = new Set<number>()
    for (const s of activeSessions) busy.add(Number(s.projectOutlineId))
    if (activeIds.length) {
      const linked = await ProjectOutlineDefenseSessionOutline.query()
        .whereIn('session_id', activeIds)
        .select('project_outline_id')
      for (const l of linked) busy.add(Number(l.projectOutlineId))
    }

    const rows = await ProjectOutline.query()
      .whereIn('status', ['PHANBIEN_KIN', 'THUYETMINH_PENDING'])
      .orderBy('id', 'asc')

    return rows
      .filter((o) => !busy.has(Number(o.id)))
      .map((o) => ProjectOutlineService.serialize(o))
  }

  static validateCouncil(members: MemberInput[]) {
    const need: Array<{ role: DefenseCouncilRole; label: string }> = [
      { role: 'CHU_TICH', label: 'Chủ tịch' },
      { role: 'THU_KY', label: 'Thư ký' },
      { role: 'PHAN_BIEN_1', label: 'Phản biện 1' },
      { role: 'PHAN_BIEN_2', label: 'Phản biện 2' },
    ]
    for (const n of need) {
      const c = members.filter((m) => m.roleInCouncil === n.role)
      if (c.length !== 1) throw new Error(`Hội đồng cần đúng 1 ${n.label}.`)
    }
    if (!members.some((m) => m.roleInCouncil === 'UY_VIEN')) {
      throw new Error('Hội đồng cần ít nhất 1 Ủy viên.')
    }
  }

  static async assertNoConflictMulti(outlineIds: number[], members: MemberInput[]) {
    for (const oid of outlineIds) {
      await ProjectOutlineDefenseService.assertNoConflict(oid, members)
    }
  }

  private static roleLabel(role: string) {
    const map: Record<string, string> = {
      CHU_TICH: 'Chủ tịch',
      THU_KY: 'Thư ký',
      PHAN_BIEN_1: 'Phản biện 1',
      PHAN_BIEN_2: 'Phản biện 2',
      UY_VIEN: 'Ủy viên',
    }
    return map[role] || role
  }

  private static escapeHtml(s: string) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  private static formatThoiGianHop(meetingAt: DateTime) {
    return meetingAt.toFormat(DATETIME_FORMAT)
  }

  /** Dữ liệu đổ vào mẫu Quyết định thành lập HĐ thẩm định. */
  static async buildDecisionMergeData(
    session: ProjectOutlineDefenseSession,
    outlines: ProjectOutline[],
    members: ProjectOutlineDefenseMember[]
  ): Promise<Record<string, string>> {
    const mau = await ContractTemplateService.getDefaultActive('QUYET_DINH')
    const cfg = chuanCauHinhQuyetDinh(mau?.mergeConfig)
    const soDuThao = String((cfg.so_moi_nhat || 0) + 1)
    const now = DateTime.now()
    const when = this.formatThoiGianHop(session.meetingAt)
    const diaDiem =
      [session.location, session.meetingUrl].filter(Boolean).join('; ') || '…'
    const maTm = outlines.map((o) => o.code).join('; ')
    const tenNv = outlines.map((o) => o.title).join('; ')
    const header = 'STT\tHọ và tên\tĐơn vị công tác\tVai trò'
    const rows = members.map(
      (m, i) =>
        `${i + 1}\t${m.memberName}\t${m.unit || '—'}\t${this.roleLabel(m.roleInCouncil)}`
    )
    const danhSach = [header, ...rows].join('\n')

    return {
      so_quyet_dinh: soDuThao,
      ngay_ban_hanh: `ngày ${now.toFormat('dd')} tháng ${now.toFormat('MM')} năm ${now.toFormat('yyyy')}`,
      van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen:
        cfg.van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen,
      quy_dinh_quan_ly_nhiem_vu_khcn_dmst: cfg.quy_dinh_quan_ly_nhiem_vu_khcn_dmst,
      van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh:
        cfg.van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh,
      chuc_danh_nguoi_de_nghi: cfg.chuc_danh_nguoi_de_nghi,
      don_vi_dau_moi: cfg.don_vi_dau_moi,
      don_vi_luu_ho_so: cfg.don_vi_luu_ho_so,
      ho_ten_nguoi_ky: cfg.ho_ten_nguoi_ky || '…………………………',
      so_thanh_vien: String(members.length).padStart(2, '0'),
      ma_thuyet_minh: maTm,
      ten_nhiem_vu: tenNv,
      thoi_gian_hop: when,
      dia_diem: diaDiem,
      ma_du_thao: session.decisionCode || '',
      danh_sach_hoi_dong: danhSach,
    }
  }

  /** HTML dự thảo QĐ — bố cục bám mẫu DOCX Quyết định thành lập HĐ. */
  static buildDecisionHtml(
    session: ProjectOutlineDefenseSession,
    outlines: ProjectOutline[],
    members: ProjectOutlineDefenseMember[],
    mergeData?: Record<string, string>
  ) {
    const e = (v?: string) => this.escapeHtml(v || '')
    const so = e(mergeData?.so_quyet_dinh || '…')
    const ngay = e(
      mergeData?.ngay_ban_hanh ||
        `ngày ${DateTime.now().toFormat('dd')} tháng ${DateTime.now().toFormat('MM')} năm ${DateTime.now().toFormat('yyyy')}`
    )
    const canCu1 = e(mergeData?.van_ban_quy_dinh_chuc_nang_nhiem_vu_tham_quyen || '…')
    const canCu2 = e(mergeData?.quy_dinh_quan_ly_nhiem_vu_khcn_dmst || '…')
    const canCu3 = e(mergeData?.van_ban_phe_duyet_danh_muc_hoac_ke_hoach_tham_dinh || '…')
    const deNghi = e(mergeData?.chuc_danh_nguoi_de_nghi || '…')
    const soTv = e(mergeData?.so_thanh_vien || String(members.length).padStart(2, '0'))
    const maTm = e(mergeData?.ma_thuyet_minh || outlines.map((o) => o.code).join('; '))
    const tenNv = e(mergeData?.ten_nhiem_vu || outlines.map((o) => o.title).join('; '))
    const when = e(mergeData?.thoi_gian_hop || this.formatThoiGianHop(session.meetingAt))
    const diaDiem = e(
      mergeData?.dia_diem ||
        [session.location, session.meetingUrl].filter(Boolean).join('; ') ||
        '…'
    )
    const donVi = e(mergeData?.don_vi_dau_moi || '…')
    const luu = e(mergeData?.don_vi_luu_ho_so || 'PKH&HTQT')
    const nguoiKy = e(mergeData?.ho_ten_nguoi_ky || '…………………………')
    const maDuThao = e(session.decisionCode || mergeData?.ma_du_thao || '—')

    const rows = members
      .map(
        (m, i) => `<tr>
  <td style="text-align:center;border:1px solid #333;padding:4px 6px">${i + 1}</td>
  <td style="border:1px solid #333;padding:4px 6px">${e(m.memberName)}</td>
  <td style="border:1px solid #333;padding:4px 6px">${e(m.unit || '—')}</td>
  <td style="border:1px solid #333;padding:4px 6px">${e(this.roleLabel(m.roleInCouncil))}</td>
</tr>`
      )
      .join('')

    return `
<div class="qd-duthao" style="font-family:'Times New Roman',Times,serif;font-size:13px;line-height:1.45;color:#111;max-width:820px;margin:0 auto">
  <table style="width:100%;border:none;margin-bottom:8px">
    <tr>
      <td style="width:42%;text-align:center;vertical-align:top;border:none">
        <div style="font-weight:700">ĐẠI HỌC ĐÀ NẴNG</div>
        <div style="font-weight:700;text-decoration:underline">TRƯỜNG ĐẠI HỌC SƯ PHẠM</div>
        <div style="margin-top:6px">Số: <strong>${so}/QĐ-ĐHSP</strong></div>
      </td>
      <td style="text-align:center;vertical-align:top;border:none">
        <div style="font-weight:700">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-weight:700;text-decoration:underline">Độc lập - Tự do - Hạnh phúc</div>
        <div style="margin-top:6px;font-style:italic">Đà Nẵng, ${ngay}</div>
      </td>
    </tr>
  </table>

  <div style="text-align:center;margin:18px 0 6px;font-weight:700;font-size:16px">QUYẾT ĐỊNH</div>
  <div style="text-align:center;font-weight:700;margin-bottom:10px">
    Về việc thành lập Hội đồng thẩm định thuyết minh<br/>
    nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo
  </div>
  <div style="text-align:center;font-weight:700;margin:12px 0">
    HIỆU TRƯỞNG TRƯỜNG ĐẠI HỌC SƯ PHẠM<br/>ĐẠI HỌC ĐÀ NẴNG
  </div>

  <p style="text-align:justify;text-indent:24px;margin:4px 0">Căn cứ ${canCu1};</p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">Căn cứ ${canCu2};</p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">Căn cứ ${canCu3};</p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">Theo đề nghị của ${deNghi}.</p>

  <div style="text-align:center;font-weight:700;margin:14px 0 8px">QUYẾT ĐỊNH:</div>

  <p style="text-align:justify;margin:8px 0"><strong>Điều 1. Thành lập Hội đồng</strong></p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Thành lập Hội đồng thẩm định thuyết minh nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo
    gồm ${soTv} thành viên theo danh sách tại Phụ lục kèm theo Quyết định này.
  </p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Hội đồng thực hiện thẩm định thuyết minh ${maTm}, tên nhiệm vụ: “${tenNv}”.
  </p>

  <p style="text-align:justify;margin:8px 0"><strong>Điều 2. Nhiệm vụ và tổ chức hoạt động của Hội đồng</strong></p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Hội đồng xem xét, đánh giá nội dung thuyết minh, mục tiêu, phương pháp, sản phẩm, tiến độ,
    tính khả thi và dự toán kinh phí; lập biên bản, kết luận và kiến nghị để trình cấp có thẩm quyền xem xét.
  </p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Thành viên Hội đồng thực hiện nhiệm vụ theo phân công; bảo đảm khách quan, bảo mật thông tin
    và kê khai xung đột lợi ích theo quy định áp dụng. Hội đồng tự giải thể sau khi hoàn thành nhiệm vụ.
  </p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Thời gian họp: ${when}. Địa điểm: ${diaDiem}.
  </p>

  <p style="text-align:justify;margin:8px 0"><strong>Điều 3. Hiệu lực và trách nhiệm thi hành</strong></p>
  <p style="text-align:justify;text-indent:24px;margin:4px 0">
    Quyết định có hiệu lực kể từ ngày ký. ${donVi}, các đơn vị, cá nhân có liên quan và các thành viên
    có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này./.
  </p>

  <table style="width:100%;border:none;margin-top:18px">
    <tr>
      <td style="width:48%;vertical-align:top;border:none;font-size:12px">
        <div><strong>Nơi nhận:</strong></div>
        <div>- Như Điều 3;</div>
        <div>- Lưu: VT, ${luu}.</div>
        <div style="margin-top:8px;font-style:italic;color:#555">Mã dự thảo: ${maDuThao}</div>
      </td>
      <td style="text-align:center;vertical-align:top;border:none">
        <div style="font-weight:700">HIỆU TRƯỞNG</div>
        <div style="height:56px"></div>
        <div style="font-weight:700">${nguoiKy}</div>
      </td>
    </tr>
  </table>

  <div style="page-break-before:always;margin-top:36px;border-top:1px dashed #999;padding-top:16px">
    <div style="text-align:center;font-weight:700;font-size:15px">PHỤ LỤC</div>
    <div style="text-align:center;font-weight:700;margin:4px 0 2px">
      DANH SÁCH HỘI ĐỒNG THẨM ĐỊNH THUYẾT MINH
    </div>
    <div style="text-align:center;font-style:italic;font-size:12px;margin-bottom:12px">
      (Kèm theo Quyết định số ${so}/QĐ-ĐHSP ${ngay} của Hiệu trưởng<br/>
      Trường Đại học Sư phạm - Đại học Đà Nẵng)
    </div>

    <p style="margin:8px 0"><strong>1. Thành phần Hội đồng</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 14px">
      <thead>
        <tr>
          <th style="border:1px solid #333;padding:4px 6px;width:48px">STT</th>
          <th style="border:1px solid #333;padding:4px 6px">Họ và tên</th>
          <th style="border:1px solid #333;padding:4px 6px">Đơn vị công tác</th>
          <th style="border:1px solid #333;padding:4px 6px;width:120px">Vai trò</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin:8px 0"><strong>2. Thuyết minh được thẩm định</strong></p>
    <p style="text-indent:24px;margin:4px 0">Mã thuyết minh: <strong>${maTm}</strong>.</p>
    <p style="text-indent:24px;margin:4px 0">Tên nhiệm vụ: <strong>${tenNv}</strong>.</p>

    <p style="margin:8px 0"><strong>3. Thông tin phiên họp</strong></p>
    <p style="text-indent:24px;margin:4px 0">Thời gian: ${when}.</p>
    <p style="text-indent:24px;margin:4px 0">Địa điểm: ${diaDiem}.</p>
    <p style="text-indent:24px;margin:4px 0">Mã dự thảo: ${maDuThao}.</p>
  </div>
</div>
`.trim()
  }

  /** Sinh file DOCX dự thảo từ mẫu Quyết định mặc định (nếu có). */
  static async renderDecisionDocx(
    session: ProjectOutlineDefenseSession,
    outlines: ProjectOutline[],
    members: ProjectOutlineDefenseMember[],
    mergeData: Record<string, string>
  ) {
    const template = await ContractTemplateService.getDefaultActive('QUYET_DINH')
    if (!template) return null
    const templatePath = await findContractTemplateFilePath(template.storedFileName)
    if (!templatePath) return null
    const merged = await mergeDocxTemplate({
      templatePath,
      data: mergeData,
      outputFileName: `QD-HDTD-${session.id}-${Date.now()}.docx`,
    })
    return merged
  }

  static async replaceOutlines(sessionId: number, outlineIds: number[]) {
    await ProjectOutlineDefenseSessionOutline.query().where('session_id', sessionId).delete()
    let i = 0
    for (const oid of outlineIds) {
      await ProjectOutlineDefenseSessionOutline.create({
        sessionId,
        projectOutlineId: oid,
        sortOrder: i++,
      })
    }
  }

  /** Bước 1–2: tạo phiên nháp, nhóm TM + HĐ + lịch */
  static async createSession(
    actorId: number,
    payload: {
      projectOutlineIds: number[]
      title?: string | null
      meetingMode: DefenseMeetingMode
      meetingAt: string
      location?: string | null
      meetingUrl?: string | null
      shortNoticeOverride?: boolean
      shortNoticeReason?: string | null
      members: MemberInput[]
    }
  ) {
    const ids = [...new Set(payload.projectOutlineIds.map(Number))].filter(Boolean)
    if (!ids.length) throw new Error('Chọn ít nhất một thuyết minh.')

    const outlines = await ProjectOutline.query().whereIn('id', ids)
    if (outlines.length !== ids.length) throw new Error('Có thuyết minh không tồn tại.')

    for (const o of outlines) {
      if (!['PHANBIEN_KIN', 'THUYETMINH_PENDING'].includes(o.status)) {
        throw new Error(`${o.code} không ở trạng thái chờ PKH tổ chức thẩm định.`)
      }
      const linked = await ProjectOutlineDefenseSessionOutline.query()
        .where('project_outline_id', o.id)
        .first()
      if (linked) throw new Error(`${o.code} đã thuộc phiên thẩm định khác.`)
    }

    const meetingAt = DateTime.fromISO(payload.meetingAt)
    if (!meetingAt.isValid) throw new Error('Thời gian họp không hợp lệ.')
    if (meetingAt <= DateTime.now()) throw new Error('Thời gian họp phải ở tương lai.')

    ProjectOutlineDefenseService.validateMeetingFields(
      payload.meetingMode,
      payload.location,
      payload.meetingUrl
    )
    this.validateCouncil(payload.members)
    await this.assertNoConflictMulti(ids, payload.members)
    await ProjectOutlineDefenseService.assertNoScheduleConflict(meetingAt, payload.members)

    const short = ProjectOutlineDefenseService.checkShortNotice(
      meetingAt,
      payload.shortNoticeOverride,
      payload.shortNoticeReason
    )
    if (!short.ok) {
      const err: any = new Error(
        'Lịch họp cách ngày gửi chưa đủ 5 ngày làm việc. Cần quyền ghi đè và lý do.'
      )
      err.code = 'LESS_THAN_5_BUSINESS_DAYS'
      throw err
    }

    const primary = outlines.find((o) => o.id === ids[0]) || outlines[0]
    const session = await ProjectOutlineDefenseSession.create({
      projectOutlineId: primary.id,
      title: payload.title?.trim() || `Phiên thẩm định ${meetingAt.toFormat('dd/MM/yyyy')}`,
      status: 'DRAFT',
      meetingMode: payload.meetingMode,
      meetingAt,
      location: payload.location?.trim() || null,
      meetingUrl: payload.meetingUrl?.trim() || null,
      shortNoticeOverride: short.needOverride,
      shortNoticeReason: short.needOverride ? payload.shortNoticeReason?.trim() || null : null,
      createdBy: actorId,
      version: 1,
    })

    await this.replaceOutlines(session.id, ids)
    const members = await ProjectOutlineDefenseService.replaceMembers(session.id, payload.members)

    for (const o of outlines) {
      await ProjectOutlineService.writeAudit(
        o.id,
        actorId,
        'CREATE_APPRAISAL_SESSION',
        o.status,
        o.status,
        { sessionId: session.id }
      )
    }

    return { session, members, outlines }
  }

  static async updateDraft(
    session: ProjectOutlineDefenseSession,
    actorId: number,
    payload: {
      title?: string | null
      meetingMode?: DefenseMeetingMode
      meetingAt?: string
      location?: string | null
      meetingUrl?: string | null
      shortNoticeOverride?: boolean
      shortNoticeReason?: string | null
      projectOutlineIds?: number[]
      members?: MemberInput[]
    }
  ) {
    if (session.status !== 'DRAFT') throw new Error('Chỉ sửa phiên đang nháp.')

    if (payload.meetingMode) session.meetingMode = payload.meetingMode
    if (payload.meetingAt) {
      const meetingAt = DateTime.fromISO(payload.meetingAt)
      if (!meetingAt.isValid) throw new Error('Thời gian họp không hợp lệ.')
      session.meetingAt = meetingAt
    }
    if (payload.location !== undefined) session.location = payload.location?.trim() || null
    if (payload.meetingUrl !== undefined) session.meetingUrl = payload.meetingUrl?.trim() || null
    if (payload.title !== undefined) session.title = payload.title?.trim() || null
    if (payload.shortNoticeOverride !== undefined) {
      session.shortNoticeOverride = !!payload.shortNoticeOverride
    }
    if (payload.shortNoticeReason !== undefined) {
      session.shortNoticeReason = payload.shortNoticeReason?.trim() || null
    }

    ProjectOutlineDefenseService.validateMeetingFields(
      session.meetingMode,
      session.location,
      session.meetingUrl
    )

    let members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    if (payload.members) {
      this.validateCouncil(payload.members)
      const outlineIds =
        payload.projectOutlineIds ||
        (await this.loadOutlines(session.id)).map((o) => o.id)
      await this.assertNoConflictMulti(outlineIds, payload.members)
      await ProjectOutlineDefenseService.assertNoScheduleConflict(
        session.meetingAt,
        payload.members,
        session.id
      )
      members = await ProjectOutlineDefenseService.replaceMembers(session.id, payload.members)
    }

    if (payload.projectOutlineIds?.length) {
      const ids = [...new Set(payload.projectOutlineIds.map(Number))]
      await this.replaceOutlines(session.id, ids)
      session.projectOutlineId = ids[0]
    }

    await session.save()
    return { session, members }
  }

  /** Bước 3: tạo dự thảo QĐ + trình BGH */
  static async submitToBgh(session: ProjectOutlineDefenseSession, actorId: number) {
    if (session.status !== 'DRAFT') throw new Error('Chỉ trình BGH từ phiên nháp.')
    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    this.validateCouncil(
      members.map((m) => ({
        userId: m.userId,
        scientificProfileId: m.scientificProfileId,
        memberName: m.memberName,
        memberEmail: m.memberEmail,
        roleInCouncil: m.roleInCouncil,
        isExternal: m.isExternal,
        unit: m.unit,
        proposedSourceNote: m.proposedSourceNote,
      }))
    )
    ProjectOutlineDefenseService.validateMeetingFields(
      session.meetingMode,
      session.location,
      session.meetingUrl
    )
    const outlines = await this.loadOutlines(session.id)
    if (!outlines.length) throw new Error('Phiên chưa có thuyết minh.')

    const year = DateTime.now().year
    session.decisionCode =
      session.decisionCode || `QĐ-HĐ-TM-${year}-${String(session.id).padStart(4, '0')}`
    const mergeData = await this.buildDecisionMergeData(session, outlines, members)
    session.decisionDraftHtml = this.buildDecisionHtml(session, outlines, members, mergeData)
    try {
      const docx = await this.renderDecisionDocx(session, outlines, members, mergeData)
      if (docx) session.decisionFileUrl = docx.fileUrl
    } catch {
      // Giữ HTML dự thảo nếu merge DOCX lỗi (thiếu mẫu / biến)
    }
    session.status = 'PENDING_BGH'
    session.submittedToBghAt = DateTime.now()
    session.submittedToBghBy = actorId
    await session.save()

    await NotificationService.pushToPermission('project.approve', {
      type: 'PROJECT_UPDATE',
      title: 'Chờ ký QĐ thành lập HĐ thẩm định',
      message: session.decisionCode || `Phiên #${session.id}`,
      link: `/projects/defenses/${session.id}`,
    })
    await NotificationService.pushToPermission('project.selection_approve', {
      type: 'PROJECT_UPDATE',
      title: 'Chờ ký QĐ thành lập HĐ thẩm định',
      message: session.decisionCode || `Phiên #${session.id}`,
      link: `/projects/defenses/${session.id}`,
    })

    return session
  }

  /** Bước 4a: BGH ký số (ghi nhận trên hệ thống) */
  static async bghSign(
    session: ProjectOutlineDefenseSession,
    actorId: number,
    note?: string | null
  ) {
    if (session.status !== 'PENDING_BGH') throw new Error('QĐ chưa ở trạng thái chờ BGH ký.')
    session.status = 'BGH_SIGNED'
    session.bghSignedAt = DateTime.now()
    session.bghSignedBy = actorId
    session.bghSignNote = note?.trim() || null
    await session.save()

    await NotificationService.pushToPermission('project.contract_publish', {
      type: 'PROJECT_UPDATE',
      title: 'QĐ HĐ thẩm định đã ký — chờ TC-HC phát hành',
      message: session.decisionCode || `Phiên #${session.id}`,
      link: `/projects/defenses/${session.id}`,
    })
    await NotificationService.pushToPermission('project.budget_confirm', {
      type: 'PROJECT_UPDATE',
      title: 'QĐ HĐ thẩm định đã ký — chờ TC-HC phát hành',
      message: session.decisionCode || `Phiên #${session.id}`,
      link: `/projects/defenses/${session.id}`,
    })

    return session
  }

  /** Bước 4b: TC-HC phát hành → email mời + tạo phiếu BM.05a */
  static async publish(session: ProjectOutlineDefenseSession, actorId: number) {
    if (session.status !== 'BGH_SIGNED') {
      throw new Error('Chỉ phát hành sau khi BGH đã ký QĐ.')
    }
    const members = await ProjectOutlineDefenseMember.query().where('session_id', session.id)
    const outlines = await this.loadOutlines(session.id)

    session.status = 'PUBLISHED'
    session.publishedAt = DateTime.now()
    session.publishedBy = actorId
    await session.save()

    // Mở phiếu BM.05a: mỗi thành viên × mỗi TM
    // Tạo phiếu trước, rồi gửi link thẳng tới phiếu BM.05a đầu tiên của từng người
    const firstSheetByMember = new Map<number, number>()
    for (const m of members) {
      for (const o of outlines) {
        let sheet = await ProjectOutlineDefenseScoreSheet.query()
          .where('session_id', session.id)
          .where('member_id', m.id)
          .where('project_outline_id', o.id)
          .first()
        if (!sheet) {
          sheet = await ProjectOutlineDefenseScoreSheet.create({
            sessionId: session.id,
            memberId: m.id,
            projectOutlineId: o.id,
            status: 'DRAFT',
            scoresJson: this.emptyBm05aScores(),
          })
        }
        if (!firstSheetByMember.has(m.id)) firstSheetByMember.set(m.id, sheet.id)
      }
    }

    const when = session.meetingAt.toFormat(DATETIME_FORMAT)
    const tmLines = outlines.map((o) => `- ${o.code}: ${o.title}`).join('\n')
    const subject = `[KH&CN] Thư mời thẩm định thuyết minh — ${session.decisionCode || session.id}`

    for (const m of members) {
      const sheetId = firstSheetByMember.get(m.id)
      // Link thẳng form BM.05a; fallback danh sách phiếu của tôi
      const formLink = sheetId
        ? `/projects/defenses/bm05a/${sheetId}`
        : '/projects/defenses/my-tasks'
      const body = [
        'Kính mời tham gia Hội đồng thẩm định thuyết minh:',
        `- Quyết định: ${session.decisionCode || '—'}`,
        `- Thời gian: ${when}`,
        session.location ? `- Địa điểm: ${session.location}` : '',
        session.meetingUrl ? `- Link họp: ${session.meetingUrl}` : '',
        '',
        'Danh sách thuyết minh (BM.04 — xem trên hệ thống):',
        tmLines,
        '',
        'Vui lòng đọc hồ sơ và nhập Phiếu đánh giá BM.05a trước ngày họp.',
        `Nhập phiếu tại: ${formLink}`,
        `Danh sách phiếu: /projects/defenses/my-tasks`,
      ]
        .filter(Boolean)
        .join('\n')

      if (m.userId) {
        await NotificationService.push(m.userId, {
          type: 'PROJECT_UPDATE',
          title: 'Mời thẩm định — nhập phiếu BM.05a',
          message: `${session.decisionCode || ''} — hạn trước ${when}`,
          link: formLink,
        })
      }
      if (m.memberEmail) {
        await EmailLogService.logStub({
          toEmail: m.memberEmail,
          subject,
          body,
          relatedType: 'project_outline_defense_session',
          relatedId: session.id,
        })
      }
    }

    for (const o of outlines) {
      const from = o.status
      o.status = 'BAOVE_PENDING'
      o.activeDefenseSessionId = session.id
      o.defenseScheduledAt = session.meetingAt
      await o.save()
      await ProjectOutlineService.writeAudit(
        o.id,
        actorId,
        'PUBLISH_APPRAISAL_SESSION',
        from,
        'BAOVE_PENDING',
        { sessionId: session.id, decisionCode: session.decisionCode }
      )
      if (o.ownerId) {
        await NotificationService.push(o.ownerId, {
          type: 'PROJECT_UPDATE',
          title: 'Lịch thẩm định thuyết minh',
          message: `${o.code} — ${when}`,
          link: `/projects/my`,
        })
      }
    }

    return session
  }

  static async listScoreProgress(sessionId: number) {
    const sheets = await ProjectOutlineDefenseScoreSheet.query().where('session_id', sessionId)
    const members = await ProjectOutlineDefenseMember.query().where('session_id', sessionId)
    const outlines = await this.loadOutlines(sessionId)
    return members.map((m) => ({
      member: ProjectOutlineDefenseService.serializeMember(m),
      outlines: outlines.map((o) => {
        const sheet = sheets.find(
          (s) => s.memberId === m.id && Number(s.projectOutlineId) === Number(o.id)
        )
        return {
          outlineId: o.id,
          outlineCode: o.code,
          sheet: sheet ? this.serializeScoreSheet(sheet) : null,
        }
      }),
    }))
  }

  static async remindMember(
    session: ProjectOutlineDefenseSession,
    memberId: number,
    actorId: number
  ) {
    if (!['PUBLISHED', 'CONFIRMED'].includes(session.status)) {
      throw new Error('Chỉ nhắc sau khi đã phát hành QĐ.')
    }
    const member = await ProjectOutlineDefenseMember.find(memberId)
    if (!member || member.sessionId !== session.id) throw new Error('Không tìm thấy thành viên.')

    const pending = await ProjectOutlineDefenseScoreSheet.query()
      .where('session_id', session.id)
      .where('member_id', memberId)
      .where('status', 'DRAFT')
    if (!pending.length) throw new Error('Thành viên này đã nộp đủ BM.05a.')

    const when = session.meetingAt.toFormat(DATETIME_FORMAT)
    const firstPending = pending[0]
    const formLink = firstPending
      ? `/projects/defenses/bm05a/${firstPending.id}`
      : '/projects/defenses/my-tasks'
    const msg = `Nhắc nhập Phiếu BM.05a trước họp ${when} (còn ${pending.length} phiếu).`
    if (member.userId) {
      await NotificationService.push(member.userId, {
        type: 'PROJECT_UPDATE',
        title: 'Nhắc nhập phiếu BM.05a',
        message: msg,
        link: formLink,
      })
    }
    if (member.memberEmail) {
      await EmailLogService.logStub({
        toEmail: member.memberEmail,
        subject: `[KH&CN] Nhắc nhập BM.05a — ${session.decisionCode || session.id}`,
        body: `${msg}\nNhập tại: ${formLink}`,
        relatedType: 'project_outline_defense_session',
        relatedId: session.id,
      })
    }
    for (const s of pending) {
      s.remindedAt = DateTime.now()
      s.remindedBy = actorId
      await s.save()
    }
    return { reminded: pending.length }
  }

  /** Hồ sơ TM đầy đủ để thành viên HĐ đọc trước khi chấm BM.05a */
  static async loadOutlineForCouncil(outlineId: number) {
    const outline = await ProjectOutline.query()
      .where('id', outlineId)
      .preload('members')
      .preload('budgetLines')
      .first()
    if (!outline) return null
    return ProjectOutlineService.serialize(outline, outline.members, outline.budgetLines)
  }

  static async getMySheet(sheetId: number, userId: number) {
    const sheet = await ProjectOutlineDefenseScoreSheet.find(sheetId)
    if (!sheet) throw new Error('Không tìm thấy phiếu.')
    const member = await ProjectOutlineDefenseMember.find(sheet.memberId)
    if (!member || Number(member.userId) !== Number(userId)) {
      throw new Error('Không có quyền xem phiếu này.')
    }
    const session = await ProjectOutlineDefenseSession.find(sheet.sessionId)
    const outline = await this.loadOutlineForCouncil(sheet.projectOutlineId)
    return {
      sheet: this.serializeScoreSheet(sheet),
      member: ProjectOutlineDefenseService.serializeMember(member),
      outline,
      session: session
        ? {
            id: session.id,
            status: session.status,
            meetingAt: session.meetingAt?.toISO() ?? null,
            decisionCode: session.decisionCode,
            location: session.location,
            meetingUrl: session.meetingUrl,
          }
        : null,
    }
  }

  static async getSheetForPkh(sheetId: number) {
    const sheet = await ProjectOutlineDefenseScoreSheet.find(sheetId)
    if (!sheet) throw new Error('Không tìm thấy phiếu.')
    const member = await ProjectOutlineDefenseMember.find(sheet.memberId)
    const session = await ProjectOutlineDefenseSession.find(sheet.sessionId)
    const outline = await this.loadOutlineForCouncil(sheet.projectOutlineId)
    return {
      sheet: this.serializeScoreSheet(sheet),
      member: member ? ProjectOutlineDefenseService.serializeMember(member) : null,
      outline,
      session: session
        ? {
            id: session.id,
            status: session.status,
            meetingAt: session.meetingAt?.toISO() ?? null,
            decisionCode: session.decisionCode,
            location: session.location,
            meetingUrl: session.meetingUrl,
          }
        : null,
    }
  }

  static async saveBm05a(
    sheet: ProjectOutlineDefenseScoreSheet,
    userId: number,
    payload: {
      precheckEligible?: boolean | null
      precheckConflictCleared?: boolean | null
      precheckEthicsOk?: boolean | null
      scores?: Array<{ code: string; score?: number | null }>
      conclusion?: string | null
      generalComment?: string | null
      submit?: boolean
    }
  ) {
    const member = await ProjectOutlineDefenseMember.findOrFail(sheet.memberId)
    if (Number(member.userId) !== Number(userId)) throw new Error('Không có quyền.')
    if (sheet.status === 'SUBMITTED' && !payload.submit) {
      throw new Error('Phiếu đã nộp.')
    }
    if (sheet.status === 'SUBMITTED') throw new Error('Phiếu đã nộp và khóa.')

    const session = await ProjectOutlineDefenseSession.findOrFail(sheet.sessionId)
    if (!['PUBLISHED', 'CONFIRMED'].includes(session.status)) {
      throw new Error('Chưa phát hành QĐ — chưa mở phiếu BM.05a.')
    }
    if (session.meetingAt <= DateTime.now() && payload.submit) {
      throw new Error('Đã qua thời điểm họp — không nộp BM.05a nữa.')
    }

    if (payload.precheckEligible !== undefined) sheet.precheckEligible = payload.precheckEligible
    if (payload.precheckConflictCleared !== undefined) {
      sheet.precheckConflictCleared = payload.precheckConflictCleared
    }
    if (payload.precheckEthicsOk !== undefined) sheet.precheckEthicsOk = payload.precheckEthicsOk
    if (payload.conclusion !== undefined) sheet.conclusion = payload.conclusion
    if (payload.generalComment !== undefined) {
      sheet.generalComment = payload.generalComment?.trim() || null
    }

    let lines = sheet.scoresJson?.length ? [...sheet.scoresJson] : this.emptyBm05aScores()
    if (payload.scores?.length) {
      for (const s of payload.scores) {
        const row = lines.find((l) => l.code === s.code)
        if (!row) continue
        if (s.score != null && (s.score < 0 || s.score > row.maxScore)) {
          throw new Error(`Điểm "${row.name}" phải từ 0 đến ${row.maxScore}.`)
        }
        row.score = s.score ?? null
      }
    }
    sheet.scoresJson = lines
    sheet.totalScore = lines.every((l) => l.score != null)
      ? Math.round(lines.reduce((a, l) => a + Number(l.score || 0), 0) * 100) / 100
      : null

    if (payload.submit) {
      const errors: string[] = []
      if (sheet.precheckEligible == null) errors.push('Chưa xác nhận đủ điều kiện tham gia.')
      if (sheet.precheckConflictCleared == null) errors.push('Chưa xác nhận BM-06.08 / xung đột.')
      if (sheet.precheckEthicsOk == null) errors.push('Chưa xác nhận đạo đức / SHTT / AI.')
      for (const l of lines) {
        if (l.score == null) errors.push(`Thiếu điểm: ${l.name}`)
      }
      if (!sheet.conclusion) errors.push('Chưa chọn kết luận.')
      const cmt = (sheet.generalComment || '').trim()
      if (cmt.length < 20) errors.push('Nhận xét cần ≥ 20 ký tự.')
      const thieu =
        sheet.precheckEligible === false ||
        sheet.precheckConflictCleared === false ||
        sheet.precheckEthicsOk === false
      if (thieu && sheet.conclusion === 'DE_XUAT') {
        errors.push('Điều kiện mục A chưa đạt — không chọn Đề nghị xét…')
      }
      if (errors.length) throw new Error(errors[0])
      sheet.status = 'SUBMITTED'
      sheet.submittedAt = DateTime.now()
    }

    await sheet.save()
    return sheet
  }

  static async listMyTasks(userId: number) {
    const memberships = await ProjectOutlineDefenseMember.query().where('user_id', userId)
    if (!memberships.length) return []
    const sessionIds = [...new Set(memberships.map((m) => m.sessionId))]
    const sessions = await ProjectOutlineDefenseSession.query()
      .whereIn('id', sessionIds)
      .whereIn('status', ['PUBLISHED', 'CONFIRMED', 'FINALIZED'])
      .orderBy('meeting_at', 'asc')
    const result = []
    for (const s of sessions) {
      const m = memberships.find((x) => x.sessionId === s.id)!
      const sheets = await ProjectOutlineDefenseScoreSheet.query()
        .where('session_id', s.id)
        .where('member_id', m.id)
      const outlines = await this.loadOutlines(s.id)
      const byId = new Map(outlines.map((o) => [Number(o.id), o]))
      result.push({
        session: {
          id: s.id,
          title: s.title,
          status: s.status,
          meetingAt: s.meetingAt?.toISO() ?? null,
          decisionCode: s.decisionCode,
          location: s.location,
          meetingUrl: s.meetingUrl,
        },
        member: ProjectOutlineDefenseService.serializeMember(m),
        sheets: sheets.map((sh) => ({
          ...this.serializeScoreSheet(sh),
          outlineCode: byId.get(Number(sh.projectOutlineId))?.code || null,
          outlineTitle: byId.get(Number(sh.projectOutlineId))?.title || null,
        })),
        pendingCount: sheets.filter((sh) => sh.status === 'DRAFT').length,
      })
    }
    return result
  }
}
