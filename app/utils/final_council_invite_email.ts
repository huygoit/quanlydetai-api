/**
 * Email mời thành viên hội đồng đánh giá cuối kỳ — kèm link hồ sơ đề nghị đánh giá KQNV.
 */

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function frontendBase() {
  return (process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '')
}

export function buildFinalCouncilInviteEmail(opts: {
  code: string
  title: string
  ownerName?: string | null
  meetingAtLabel: string
  location?: string | null
  roleLabel: string
  memberName?: string | null
  /** Đường dẫn FE tương đối, vd /projects/final-eval/12 */
  dossierPath: string
}) {
  const base = frontendBase()
  const url = base ? `${base}${opts.dossierPath}` : opts.dossierPath
  const greeting = (opts.memberName || '').trim() || 'Quý Thầy/Cô'
  const loc = (opts.location || '').trim()
  const owner = (opts.ownerName || '').trim() || '—'

  const subject = `[KH&CN] Mời hội đồng đánh giá cuối kỳ — ${opts.code}`

  const text = [
    `Kính gửi ${greeting},`,
    '',
    'Phòng Khoa học trân trọng mời Quý Thầy/Cô tham gia Hội đồng đánh giá kết quả nhiệm vụ khoa học và công nghệ.',
    '',
    `Mã nhiệm vụ: ${opts.code}`,
    `Tên nhiệm vụ: ${opts.title}`,
    `Chủ nhiệm: ${owner}`,
    `Vai trò trong hội đồng: ${opts.roleLabel}`,
    `Thời gian họp: ${opts.meetingAtLabel}`,
    loc ? `Địa điểm: ${loc}` : '',
    '',
    'Quý Thầy/Cô vui lòng vào phiếu đánh giá kết quả cuối kỳ (xem hồ sơ CNNV đã nộp và nộp phiếu đánh giá):',
    url,
    '',
    'Trân trọng,',
    'Hệ thống Quản lý Khoa học và Công nghệ',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:22px 28px;">
              <div style="font-size:12px;letter-spacing:.04em;color:#bfdbfe;text-transform:uppercase;font-weight:600;">Hội đồng đánh giá cuối kỳ</div>
              <div style="margin-top:8px;font-size:20px;line-height:1.35;font-weight:700;color:#fff;">Thư mời tham gia hội đồng</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Kính gửi <strong>${escapeHtml(greeting)}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                Phòng Khoa học trân trọng mời Quý Thầy/Cô tham gia Hội đồng đánh giá kết quả nhiệm vụ KH&amp;CN.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:38%;">Mã nhiệm vụ</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#0f172a;font-weight:600;">${escapeHtml(opts.code)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Tên nhiệm vụ</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#0f172a;">${escapeHtml(opts.title)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Chủ nhiệm</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#0f172a;">${escapeHtml(owner)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Vai trò</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#0f172a;">${escapeHtml(opts.roleLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;${loc ? 'border-bottom:1px solid #e8eef5;' : ''}color:#64748b;">Thời gian họp</td>
                  <td style="padding:10px 14px;${loc ? 'border-bottom:1px solid #e8eef5;' : ''}color:#0f172a;">${escapeHtml(opts.meetingAtLabel)}</td>
                </tr>
                ${
                  loc
                    ? `<tr>
                  <td style="padding:10px 14px;color:#64748b;">Địa điểm</td>
                  <td style="padding:10px 14px;color:#0f172a;">${escapeHtml(loc)}</td>
                </tr>`
                    : ''
                }
              </table>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
                Vui lòng vào phiếu đánh giá kết quả cuối kỳ để xem hồ sơ chủ nhiệm đã nộp và nộp phiếu đánh giá.
              </p>
              <a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
                Mở phiếu đánh giá kết quả cuối kỳ
              </a>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">${escapeHtml(url)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html, url }
}
