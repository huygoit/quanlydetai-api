/**
 * Nội dung email thông báo BGH phê duyệt thuyết minh → mở Module 5.
 */

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatBudget(n: number) {
  return `${Number(n || 0).toLocaleString('vi-VN')} đ`
}

function frontendBase() {
  const raw = (process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || '').trim()
  return raw.replace(/\/$/, '')
}

export function buildOutlineApprovedEmail(opts: {
  code: string
  title: string
  ownerName?: string | null
  approvedBudget: number
  bghNote?: string | null
  outlineId: number
}) {
  const base = frontendBase()
  const path = `/projects/execution/${opts.outlineId}`
  const module5Url = base ? `${base}${path}` : path
  const owner = (opts.ownerName || '').trim() || 'Quý Thầy/Cô'
  const note = (opts.bghNote || '').trim()
  const budget = formatBudget(opts.approvedBudget)
  const code = escapeHtml(opts.code)
  const title = escapeHtml(opts.title)

  const subject = `[KH&CN] Thuyết minh ${opts.code} đã được phê duyệt — mở triển khai`

  const text = [
    `Kính gửi ${owner},`,
    '',
    'Ban Giám hiệu đã phê duyệt thuyết minh nhiệm vụ khoa học và công nghệ của Quý Thầy/Cô.',
    '',
    `Mã thuyết minh: ${opts.code}`,
    `Tên nhiệm vụ: ${opts.title}`,
    `Kết quả: Được duyệt (TM_DUOC_DUYET)`,
    `Kinh phí được duyệt: ${budget}`,
    note ? `Ghi chú BGH: ${note}` : '',
    '',
    `Module 5 (triển khai): ${module5Url}`,
    '',
    'Vui lòng đăng nhập hệ thống để xem chi tiết, phối hợp hoàn thiện hợp đồng và triển khai thực hiện.',
    '',
    'Trân trọng,',
    'Hệ thống Quản lý Khoa học và Công nghệ',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const noteRow = note
    ? `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:38%;vertical-align:top;">Ghi chú BGH</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#0f172a;white-space:pre-wrap;">${escapeHtml(note)}</td>
      </tr>`
    : ''

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
            <td style="background:linear-gradient(135deg,#0f766e,#115e59);padding:22px 28px;">
              <div style="font-size:13px;letter-spacing:.04em;color:#99f6e4;text-transform:uppercase;font-weight:600;">
                Quản lý Khoa học &amp; Công nghệ
              </div>
              <div style="margin-top:8px;font-size:22px;line-height:1.35;font-weight:700;color:#ffffff;">
                Thuyết minh đã được phê duyệt
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                Kính gửi <strong>${escapeHtml(owner)}</strong>,
              </p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#334155;">
                Ban Giám hiệu đã phê duyệt thuyết minh nhiệm vụ khoa học và công nghệ của Quý Thầy/Cô.
                Hệ thống đã mở <strong>Module 5 — Triển khai</strong> để tiếp tục các bước thực hiện.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 20px;">
                <tr>
                  <td colspan="2" style="background:#f8fafc;padding:12px 14px;font-size:13px;font-weight:700;color:#0f766e;border-bottom:1px solid #e2e8f0;">
                    Thông tin phê duyệt
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:38%;">Mã thuyết minh</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:600;">${code}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;vertical-align:top;">Tên nhiệm vụ</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${title}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Kết quả</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">
                    <span style="display:inline-block;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:600;">
                      Được duyệt
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Kinh phí được duyệt</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-size:16px;font-weight:700;color:#0f766e;">
                    ${escapeHtml(budget)}
                  </td>
                </tr>
                ${noteRow}
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
                <tr>
                  <td style="border-radius:8px;background:#0f766e;">
                    <a href="${escapeHtml(module5Url)}"
                       style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                      Mở Module 5 — Triển khai
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b;">
                Nếu nút không mở được, dùng liên kết sau:<br />
                <a href="${escapeHtml(module5Url)}" style="color:#0f766e;word-break:break-all;">${escapeHtml(module5Url)}</a>
              </p>
              <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#334155;">
                Vui lòng đăng nhập hệ thống để xem chi tiết, phối hợp hoàn thiện hợp đồng và triển khai thực hiện.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Trân trọng,<br />
                <strong style="color:#0f172a;">Hệ thống Quản lý Khoa học và Công nghệ</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html, module5Url }
}
