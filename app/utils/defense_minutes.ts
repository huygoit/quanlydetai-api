import { DateTime } from 'luxon'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import type ProjectOutline from '#models/project_outline'
import type ProjectOutlineDefenseSession from '#models/project_outline_defense_session'
import type ProjectOutlineDefenseMember from '#models/project_outline_defense_member'

const MODE_LABEL: Record<string, string> = {
  IN_PERSON: 'Trực tiếp',
  ONLINE: 'Trực tuyến',
  HYBRID: 'Kết hợp',
}

const ROLE_LABEL: Record<string, string> = {
  CHU_TICH: 'Chủ tịch',
  THU_KY: 'Thư ký',
  UY_VIEN: 'Ủy viên',
}

const CONCLUSION_LABEL: Record<string, string> = {
  THONG_QUA: 'Thông qua',
  THONG_QUA_DIEU_CHINH: 'Thông qua có điều chỉnh',
  KHONG_THONG_QUA: 'Không thông qua',
}

const ATT_LABEL: Record<string, string> = {
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng',
  PENDING: 'Chưa ghi nhận',
}

/**
 * Sinh biên bản bảo vệ thuyết minh dạng HTML (in PDF từ trình duyệt).
 */
export async function generateDefenseMinutesHtml(
  session: ProjectOutlineDefenseSession,
  outline: ProjectOutline,
  members: ProjectOutlineDefenseMember[],
  reviewScores: Array<{ reviewerLabel: string; totalScore: number | null }>
): Promise<{ html: string; relativeUrl: string }> {
  const membersHtml = members.length
    ? `<ul>${members
        .map(
          (m) =>
            `<li>${escapeHtml(m.memberName)} — ${ROLE_LABEL[m.roleInCouncil] || m.roleInCouncil}${
              m.isExternal ? ' (ngoài trường)' : ''
            } — ${ATT_LABEL[m.attendance || 'PENDING'] || ''}</li>`
        )
        .join('')}</ul>`
    : '<p><em>Chưa có thành phần HĐ.</em></p>'

  const scoresHtml = reviewScores.length
    ? `<ul>${reviewScores
        .map(
          (s) =>
            `<li>${escapeHtml(s.reviewerLabel)}: ${
              s.totalScore != null ? s.totalScore : '—'
            }</li>`
        )
        .join('')}</ul>`
    : '<p><em>Không có phiếu phản biện.</em></p>'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Biên bản bảo vệ thuyết minh ${escapeHtml(outline.code)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; line-height: 1.45; }
  h1 { font-size: 18px; text-align: center; }
  h2 { font-size: 14px; margin-top: 20px; }
</style>
</head>
<body>
  <h1>BIÊN BẢN BẢO VỆ THUYẾT MINH ĐỀ TÀI</h1>
  <p><strong>Mã:</strong> ${escapeHtml(outline.code)}</p>
  <p><strong>Tên đề tài:</strong> ${escapeHtml(outline.title)}</p>
  <p><strong>Chủ nhiệm:</strong> ${escapeHtml(outline.ownerName || '')}
    ${outline.ownerUnit ? ` — ${escapeHtml(outline.ownerUnit)}` : ''}</p>
  <p><strong>Thời gian:</strong> ${session.meetingAt.toFormat('dd/MM/yyyy HH:mm')}</p>
  <p><strong>Hình thức:</strong> ${MODE_LABEL[session.meetingMode] || session.meetingMode}</p>
  <p><strong>Địa điểm:</strong> ${escapeHtml(session.location || '—')}</p>
  ${session.meetingUrl ? `<p><strong>Link họp:</strong> ${escapeHtml(session.meetingUrl)}</p>` : ''}
  <h2>Thành phần Hội đồng</h2>
  ${membersHtml}
  <h2>Điểm phản biện kín</h2>
  ${scoresHtml}
  <p><strong>Điểm trung bình:</strong> ${
    outline.reviewAverageScore != null ? outline.reviewAverageScore : '—'
  }</p>
  ${
    session.finalScore != null
      ? `<p><strong>Điểm tổng kết HĐ:</strong> ${session.finalScore}</p>`
      : ''
  }
  <h2>Ý kiến thảo luận / kết luận</h2>
  <p>${escapeHtml(session.discussionNotes || '').replace(/\n/g, '<br/>')}</p>
  <p><strong>Kết luận:</strong> ${
    CONCLUSION_LABEL[session.conclusion || ''] || session.conclusion || '—'
  }</p>
  ${
    session.adjustmentRequirements
      ? `<p><strong>Yêu cầu chỉnh sửa:</strong><br/>${escapeHtml(
          session.adjustmentRequirements
        ).replace(/\n/g, '<br/>')}</p>`
      : ''
  }
  ${
    session.adjustmentDeadline
      ? `<p><strong>Hạn chỉnh sửa:</strong> ${session.adjustmentDeadline.toFormat('dd/MM/yyyy')}</p>`
      : ''
  }
  <p style="margin-top:24px"><em>Sinh lúc ${DateTime.now().toFormat(
    'dd/MM/yyyy HH:mm'
  )} — hệ thống KH&CN.</em></p>
</body>
</html>`

  const dir = path.join(app.makePath('public'), 'uploads', 'defense-minutes')
  await mkdir(dir, { recursive: true })
  const filename = `bien-ban-bao-ve-${outline.code}-v${session.version || 1}.html`
  await writeFile(path.join(dir, filename), html, 'utf8')
  return { html, relativeUrl: `/uploads/defense-minutes/${filename}` }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
