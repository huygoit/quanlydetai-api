import { DateTime } from 'luxon'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import type ProposalSelectionSession from '#models/proposal_selection_session'
import type ProposalSelectionSessionItem from '#models/proposal_selection_session_item'

const RESULT_LABEL: Record<string, string> = {
  DONG_Y: 'Đồng ý',
  KHONG_DONG_Y: 'Không đồng ý',
}

/**
 * Sinh biên bản họp dạng HTML (UTF-8) — in/lưu PDF từ trình duyệt.
 * Tránh thêm dependency PDF + font tiếng Việt.
 */
export async function generateSelectionMinutesHtml(
  session: ProposalSelectionSession,
  items: Array<
    ProposalSelectionSessionItem & {
      projectProposal?: {
        code?: string
        title?: string
        ownerName?: string
        ownerUnit?: string
      } | null
    }
  >
): Promise<{ html: string; relativeUrl: string }> {
  const members = Array.isArray(session.councilMembers) ? session.councilMembers : []
  const membersHtml = members.length
    ? `<ul>${members.map((m: any) => `<li>${escapeHtml(String(m.name || m))}${m.role ? ` — ${escapeHtml(String(m.role))}` : ''}</li>`).join('')}</ul>`
    : '<p><em>Chưa cập nhật thành phần Hội đồng.</em></p>'

  const rows = items
    .map((it, i) => {
      const p = it.projectProposal
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p?.code || '')}</td>
        <td>${escapeHtml(p?.title || '')}</td>
        <td>${escapeHtml(p?.ownerName || '')}</td>
        <td>${escapeHtml(p?.ownerUnit || '')}</td>
        <td>${escapeHtml(it.councilOpinion || '')}</td>
        <td>${escapeHtml(RESULT_LABEL[it.councilResult || ''] || it.councilResult || '')}</td>
        <td>${escapeHtml(it.adjustmentNote || '')}</td>
      </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Biên bản phiên xét chọn #${session.id}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; text-align: center; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px; vertical-align: top; }
  th { background: #f0f0f0; }
</style>
</head>
<body>
  <h1>BIÊN BẢN HỌP HỘI ĐỒNG TƯ VẤN XÉT CHỌN ĐỀ TÀI</h1>
  <p><strong>Phiên:</strong> ${escapeHtml(session.title || `Phiên #${session.id}`)}</p>
  <p><strong>Ngày họp:</strong> ${session.meetingAt.toFormat('dd/MM/yyyy HH:mm')}</p>
  <p><strong>Địa điểm:</strong> ${escapeHtml(session.location)}</p>
  <h2>Thành phần Hội đồng</h2>
  ${membersHtml}
  <h2>Kết quả xét chọn từng đề xuất</h2>
  <table>
    <thead>
      <tr>
        <th>STT</th><th>Mã</th><th>Tên đề tài</th><th>Chủ nhiệm</th><th>Đơn vị</th>
        <th>Ý kiến HĐ</th><th>Kết quả</th><th>Góp ý hội đồng</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px"><em>Sinh lúc ${DateTime.now().toFormat('dd/MM/yyyy HH:mm')} — hệ thống KH&CN.</em></p>
</body>
</html>`

  const dir = path.join(app.makePath('public'), 'uploads', 'selection-minutes')
  await mkdir(dir, { recursive: true })
  const filename = `bien-ban-phien-${session.id}-v${session.version || 1}.html`
  await writeFile(path.join(dir, filename), html, 'utf8')
  const relativeUrl = `/uploads/selection-minutes/${filename}`
  return { html, relativeUrl }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
