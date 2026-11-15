/**
 * Email yêu cầu bổ sung hồ sơ tạm ứng (BM.07)
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
          <td style="background:linear-gradient(135deg,#0f766e,#115e59);padding:22px 28px;">
            <div style="font-size:12px;letter-spacing:.04em;color:#99f6e4;text-transform:uppercase;font-weight:600;">${escapeHtml(opts.eyebrow)}</div>
            <div style="margin-top:8px;font-size:20px;line-height:1.35;font-weight:700;color:#fff;">${escapeHtml(opts.title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${opts.greeting}</p>
            ${opts.bodyHtml}
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 12px;">
              <tr><td style="border-radius:8px;background:#0f766e;">
                <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(opts.ctaLabel)}</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">
              Liên kết: <a href="${escapeHtml(url)}" style="color:#0f766e;">${escapeHtml(url)}</a>
            </p>
            ${opts.footerNote ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">${escapeHtml(opts.footerNote)}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 22px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
            Trân trọng,<br /><strong style="color:#0f172a;">Phòng Khoa học &amp; Hợp tác quốc tế</strong><br />
            Hệ thống Quản lý Khoa học và Công nghệ
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function buildPaymentReturnEmail(opts: {
  ownerName?: string | null
  code: string
  title: string
  amountLabel: string
  lineLabel: string
  note: string
  paymentId: number
  contractId?: number | null
}) {
  const owner = (opts.ownerName || '').trim() || 'Quý Thầy/Cô'
  const subject = `[KH&CN] Hồ sơ tạm ứng ${opts.code} cần bổ sung`
  const path = opts.contractId
    ? `/projects/contracts/${opts.contractId}?tab=tamung`
    : `/projects/payments/${opts.paymentId}`
  const text = [
    `Kính gửi ${owner},`,
    '',
    `Phòng Khoa học & HTQT đã xem xét hồ sơ tạm ứng của Quý Thầy/Cô và kính đề nghị bổ sung.`,
    `Mã nhiệm vụ: ${opts.code}`,
    `Tên nhiệm vụ: ${opts.title}`,
    `Khoản chi: ${opts.lineLabel}`,
    `Số tiền: ${opts.amountLabel}`,
    `Nội dung cần bổ sung: ${opts.note}`,
    '',
    `Quý Thầy/Cô vui lòng chỉnh sửa và nộp lại tại: ${path}`,
    '',
    'Trân trọng,',
    'Phòng Khoa học & Hợp tác quốc tế',
  ].join('\n')

  const mail = wrapMail({
    eyebrow: 'Hồ sơ tạm ứng · BM.07',
    title: 'Yêu cầu bổ sung hồ sơ tạm ứng',
    greeting: `Kính gửi <strong>${escapeHtml(owner)}</strong>,`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">
        Phòng Khoa học &amp; Hợp tác quốc tế đã tiếp nhận và xem xét <strong>hồ sơ tạm ứng</strong> của Quý Thầy/Cô.
        Để hoàn thiện thủ tục, kính đề nghị Quý Thầy/Cô <strong>bổ sung / chỉnh sửa</strong> theo nội dung dưới đây.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px;">
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;width:36%;">Mã nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:600;">${escapeHtml(opts.code)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Tên nhiệm vụ</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${escapeHtml(opts.title)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Khoản chi</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;">${escapeHtml(opts.lineLabel)}</td></tr>
        <tr><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;color:#64748b;">Số tiền đề nghị</td><td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-weight:600;">${escapeHtml(opts.amountLabel)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;vertical-align:top;">Nội dung cần bổ sung</td><td style="padding:10px 14px;white-space:pre-wrap;color:#9a3412;font-weight:500;">${escapeHtml(opts.note)}</td></tr>
      </table>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#334155;">
        Sau khi bổ sung, Quý Thầy/Cô vui lòng <strong>nộp lại hồ sơ</strong> để Phòng Khoa học tiếp tục thẩm định.
      </p>`,
    ctaLabel: 'Bổ sung hồ sơ tạm ứng',
    ctaPath: path,
    footerNote: 'Email này được gửi tự động từ Hệ thống Quản lý KH&CN. Vui lòng không trả lời email này.',
  })

  return { subject, text, html: mail.html }
}
