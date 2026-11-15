/**
 * Email nhắc hạn / trả bổ sung báo cáo tiến độ BM.08
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

function wrapMail(opts: {
  eyebrow: string
  title: string
  greeting: string
  bodyHtml: string
  ctaLabel: string
  ctaPath: string
  footerNote?: string
}) {
  const base = frontendBase()
  const url = base ? `${base}${opts.ctaPath}` : opts.ctaPath
  return {
    url,
    html: `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:22px 28px;">
            <div style="font-size:12px;letter-spacing:.04em;color:#bfdbfe;text-transform:uppercase;font-weight:600;">${escapeHtml(opts.eyebrow)}</div>
            <div style="margin-top:8px;font-size:20px;line-height:1.35;font-weight:700;color:#fff;">${escapeHtml(opts.title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${opts.greeting}</p>
            ${opts.bodyHtml}
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 12px;">
              <tr><td style="border-radius:8px;background:#1d4ed8;">
                <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(opts.ctaLabel)}</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">
              Liên kết: <a href="${escapeHtml(url)}" style="color:#1d4ed8;">${escapeHtml(url)}</a>
            </p>
            ${opts.footerNote ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">${escapeHtml(opts.footerNote)}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 22px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
            Trân trọng,<br /><strong style="color:#0f172a;">Hệ thống Quản lý Khoa học và Công nghệ</strong>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function buildProgressReminderEmail(opts: {
  ownerName?: string | null
  code: string
  title: string
  periodTitle: string
  dueOn: string
  daysLeft: number
  outlineId: number
}) {
  const owner = (opts.ownerName || '').trim() || 'Quý Thầy/Cô'
  const subject = `[KH&CN] Nhắc nộp báo cáo tiến độ — còn ${opts.daysLeft} ngày (${opts.code})`
  const path = `/projects/progress/${opts.outlineId}?tab=tiendo`
  const text = [
    `Kính gửi ${owner},`,
    '',
    `Hệ thống nhắc Quý Thầy/Cô nộp Báo cáo tình hình thực hiện nhiệm vụ (BM.08).`,
    `Mã: ${opts.code}`,
    `Tên: ${opts.title}`,
    `Kỳ báo cáo: ${opts.periodTitle}`,
    `Hạn nộp: ${opts.dueOn}`,
    `Còn lại: ${opts.daysLeft} ngày`,
    '',
    `Nộp báo cáo tại: ${path}`,
    '',
    'Trân trọng,',
    'Hệ thống Quản lý KH&CN',
  ].join('\n')

  const mail = wrapMail({
    eyebrow: 'Báo cáo tiến độ · BM.08',
    title: `Còn ${opts.daysLeft} ngày đến hạn nộp báo cáo`,
    greeting: `Kính gửi <strong>${escapeHtml(owner)}</strong>,`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">
        Hệ thống nhắc tự động trước mốc kiểm tra tiến độ. Vui lòng nộp <strong>BM.08 – Báo cáo tình hình thực hiện nhiệm vụ</strong> đúng hạn.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:36%;">Mã nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:600;">${escapeHtml(opts.code)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Tên nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${escapeHtml(opts.title)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Kỳ báo cáo</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${escapeHtml(opts.periodTitle)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Hạn nộp</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:700;color:#b45309;">${escapeHtml(opts.dueOn)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;">Thời gian còn lại</td><td style="padding:10px 14px;"><span style="background:#fff7ed;color:#c2410c;border:1px solid #fdba74;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:600;">${opts.daysLeft} ngày</span></td></tr>
      </table>`,
    ctaLabel: 'Nộp báo cáo tiến độ',
    ctaPath: path,
  })

  return { subject, text, html: mail.html }
}

export function buildProgressReturnEmail(opts: {
  ownerName?: string | null
  code: string
  title: string
  note: string
  outlineId: number
}) {
  const owner = (opts.ownerName || '').trim() || 'Quý Thầy/Cô'
  const subject = `[KH&CN] Báo cáo tiến độ ${opts.code} cần bổ sung`
  const path = `/projects/progress/${opts.outlineId}?tab=tiendo`
  const text = [
    `Kính gửi ${owner},`,
    '',
    `PKH&HTQT yêu cầu bổ sung báo cáo tiến độ (BM.08).`,
    `Mã: ${opts.code}`,
    `Tên: ${opts.title}`,
    `Nội dung cần bổ sung: ${opts.note}`,
    '',
    `Chỉnh sửa và nộp lại tại: ${path}`,
    '',
    'Trân trọng,',
    'Hệ thống Quản lý KH&CN',
  ].join('\n')

  const mail = wrapMail({
    eyebrow: 'Báo cáo tiến độ · BM.08',
    title: 'Yêu cầu bổ sung báo cáo tiến độ',
    greeting: `Kính gửi <strong>${escapeHtml(owner)}</strong>,`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">
        Phòng Khoa học &amp; HTQT đã xem báo cáo của Quý Thầy/Cô và yêu cầu bổ sung trước khi ghi nhận.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px;">
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:36%;">Mã nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:600;">${escapeHtml(opts.code)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Tên nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${escapeHtml(opts.title)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;vertical-align:top;">Nội dung cần bổ sung</td><td style="padding:10px 14px;white-space:pre-wrap;color:#9a3412;">${escapeHtml(opts.note)}</td></tr>
      </table>`,
    ctaLabel: 'Bổ sung báo cáo',
    ctaPath: path,
    footerNote: 'Sau khi chỉnh sửa, vui lòng nộp lại để PKH&HTQT ghi nhận.',
  })

  return { subject, text, html: mail.html }
}
