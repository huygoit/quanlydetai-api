import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import type ProjectOutline from '#models/project_outline'
import type ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import type ProjectOutlineDefenseMember from '#models/project_outline_defense_member'
import type ProjectOutlineDefenseMinutesItem from '#models/project_outline_defense_minutes_item'
import { DATETIME_FORMAT } from '#constants/datetime_formats'

const ROLE_LABEL: Record<string, string> = {
  CHU_TICH: 'Chủ tịch / Chủ trì',
  THU_KY: 'Thư ký',
  PHAN_BIEN_1: 'Phản biện 1',
  PHAN_BIEN_2: 'Phản biện 2',
  UY_VIEN: 'Ủy viên',
}

const CONCLUSION_LABEL: Record<string, string> = {
  DE_XUAT_XET: 'Đề nghị xét tài trợ/đặt hàng/lựa chọn',
  GIAO_TRUC_TIEP: 'Đề nghị giao trực tiếp',
  HOAN_THIEN: 'Đề nghị hoàn thiện hồ sơ',
  KHONG_DE_XUAT: 'Không đề nghị xét tài trợ/đặt hàng/lựa chọn/giao trực tiếp',
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type ScoreBlock = {
  outline: ProjectOutline
  summary: {
    totalBallots: number
    validBallots: number
    invalidBallots: number
    averageScore: number | null
    memberScores: Array<{
      memberName: string
      roleInCouncil: string
      status: string
      totalScore: number | null
    }>
  }
  item: ProjectOutlineDefenseMinutesItem
}

/** PDF/HTML biên bản theo mẫu BM-02.10 */
export async function generateAppraisalMinutesHtml(
  session: ProjectOutlineDefenseSession,
  members: ProjectOutlineDefenseMember[],
  blocks: ScoreBlock[]
): Promise<{ html: string; relativeUrl: string }> {
  const when = session.meetingAt?.toFormat(DATETIME_FORMAT) || '—'
  const chuTri = members.find((m) => m.roleInCouncil === 'CHU_TICH')
  const thuKy = members.find((m) => m.roleInCouncil === 'THU_KY')
  const present = members.filter((m) => m.attendance === 'PRESENT')
  const absent = members.filter((m) => m.attendance === 'ABSENT')
  const others = present.filter(
    (m) => m.roleInCouncil !== 'CHU_TICH' && m.roleInCouncil !== 'THU_KY'
  )

  const tasksHtml = blocks
    .map((b, idx) => {
      const rows = b.summary.memberScores
        .map(
          (s, i) =>
            `<tr>
              <td style="text-align:center">${i + 1}</td>
              <td>${escapeHtml(s.memberName)} (${escapeHtml(ROLE_LABEL[s.roleInCouncil] || s.roleInCouncil)})</td>
              <td style="text-align:center">${s.totalScore != null ? s.totalScore : '—'}</td>
              <td>${s.status === 'SUBMITTED' ? 'Hợp lệ' : 'Không hợp lệ (chưa nộp)'}</td>
            </tr>`
        )
        .join('')
      const ketLuan = b.item.councilConclusion
        ? CONCLUSION_LABEL[b.item.councilConclusion] || b.item.councilConclusion
        : '—'
      return `
      <h3>${idx + 1}. ${escapeHtml(b.outline.code)} — ${escapeHtml(b.outline.title)}</h3>
      <p><strong>Chủ nhiệm:</strong> ${escapeHtml(b.outline.ownerName || '')}</p>
      <p>Tổng phiếu: ${b.summary.totalBallots} — Hợp lệ: ${b.summary.validBallots} — Không hợp lệ: ${b.summary.invalidBallots} — Điểm TB: <strong>${b.summary.averageScore ?? '—'}</strong></p>
      <table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px">
        <thead><tr><th>STT</th><th>Thành viên HĐ</th><th>Điểm</th><th>Kết luận phiếu</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Kết luận HĐ:</strong> ${escapeHtml(ketLuan)}</p>
      ${b.item.executionContent ? `<p><strong>Nội dung thực hiện:</strong> ${escapeHtml(b.item.executionContent)}</p>` : ''}
      ${b.item.adjustmentRequirements ? `<p><strong>Yêu cầu hoàn thiện:</strong> ${escapeHtml(b.item.adjustmentRequirements)}</p>` : ''}
      ${b.item.note ? `<p><strong>Ghi chú:</strong> ${escapeHtml(b.item.note)}</p>` : ''}
      `
    })
    .join('<hr/>')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Biên bản họp HĐ thẩm định ${escapeHtml(session.decisionCode || String(session.id))}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; margin: 28px; color: #111; line-height: 1.45; font-size: 14px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .header .left, .header .right { width: 48%; text-align: center; }
  .header strong { display: block; }
  h1 { font-size: 16px; text-align: center; text-transform: uppercase; margin: 18px 0; }
  h2 { font-size: 14px; margin-top: 16px; }
  h3 { font-size: 13px; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
  .sign div { width: 40%; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      <div>ĐẠI HỌC ĐÀ NẴNG</div>
      <strong>TRƯỜNG ĐẠI HỌC SƯ PHẠM</strong>
    </div>
    <div class="right">
      <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
      <strong>Độc lập - Tự do - Hạnh phúc</strong>
      <div style="margin-top:8px;font-style:italic">Đà Nẵng, ${when}</div>
    </div>
  </div>

  <h1>BIÊN BẢN HỌP HỘI ĐỒNG/TỔ CHUYÊN GIA ĐÁNH GIÁ HỒ SƠ XÉT TÀI TRỢ/ĐẶT HÀNG/TUYỂN CHỌN/GIAO TRỰC TIẾP</h1>
  <p style="text-align:center"><em>BM-02.10 / BM.05b — QĐ thành lập HĐ: ${escapeHtml(session.decisionCode || '—')}</em></p>

  <h2>1. Thời gian, địa điểm</h2>
  <p>Thời gian: ${escapeHtml(when)}</p>
  <p>Địa điểm / Link: ${escapeHtml([session.location, session.meetingUrl].filter(Boolean).join(' | ') || '—')}</p>

  <h2>2. Thành phần</h2>
  <p><strong>Chủ trì:</strong> ${escapeHtml(chuTri?.memberName || '—')}</p>
  <p><strong>Thư ký:</strong> ${escapeHtml(thuKy?.memberName || '—')}</p>
  <p><strong>Thành viên:</strong> ${
    others.length
      ? others.map((m) => escapeHtml(m.memberName)).join('; ')
      : '—'
  }</p>
  <p><strong>Vắng mặt:</strong> ${
    absent.length ? absent.map((m) => escapeHtml(m.memberName)).join('; ') : 'Không'
  }</p>

  <h2>3. Nội dung — Kết quả đánh giá từng nhiệm vụ</h2>
  ${tasksHtml}

  <h2>5. Kết luận</h2>
  <p>Hội đồng/Tổ chuyên gia thống nhất kết luận theo từng nhiệm vụ như mục 3.</p>

  <h2>6. Kiến nghị</h2>
  <p>${escapeHtml(session.recommendations || '—')}</p>

  <div class="sign">
    <div>
      <strong>CHỦ TRÌ</strong><br/>(Ký, ghi rõ họ tên)<br/><br/><br/>
      ${escapeHtml(chuTri?.memberName || '')}
    </div>
    <div>
      <strong>THƯ KÝ</strong><br/>(Ký, ghi rõ họ tên)<br/><br/><br/>
      ${escapeHtml(thuKy?.memberName || '')}
    </div>
  </div>
</body>
</html>`

  const dir = path.join(app.makePath('public'), 'uploads', 'defense-minutes')
  await mkdir(dir, { recursive: true })
  const fileName = `bb-tham-dinh-${session.id}-${Date.now()}.html`
  await writeFile(path.join(dir, fileName), html, 'utf8')
  const relativeUrl = `/uploads/defense-minutes/${fileName}`
  return { html, relativeUrl }
}
