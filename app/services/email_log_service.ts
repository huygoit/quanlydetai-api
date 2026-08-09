import EmailLog from '#models/email_log'
import User from '#models/user'
import MailService from '#services/mail_service'

export type SendEmailOpts = {
  toEmail: string
  subject: string
  body: string
  relatedType?: string
  relatedId?: number
  /** HTML tùy chọn; mặc định gửi plain text */
  html?: string
}

/**
 * Gửi email nghiệp vụ + ghi email_logs.
 * - Có SMTP (.env): gửi thật → SENT | FAILED
 * - Chưa cấu hình SMTP: ghi STUB (dev), không ném lỗi
 */
export default class EmailLogService {
  static async send(opts: SendEmailOpts) {
    const toEmail = (opts.toEmail || '').trim()
    if (!toEmail) return null

    const log = await EmailLog.create({
      toEmail,
      subject: opts.subject,
      body: opts.body,
      relatedType: opts.relatedType ?? null,
      relatedId: opts.relatedId ?? null,
      status: 'PENDING',
      errorMessage: null,
    })

    if (!MailService.isConfigured()) {
      log.status = 'STUB'
      log.errorMessage = MailService.isEnabledFlag()
        ? 'SMTP_ENABLED=true nhưng thiếu SMTP_HOST/USER/PASSWORD — chưa gửi thật.'
        : 'SMTP_ENABLED≠true — chế độ kiểm thử: chỉ ghi log, không gửi mail.'
      await log.save()
      return log
    }

    // Allowlist: test gửi thật nhưng không blast cả danh sách staffs
    if (!MailService.isRecipientAllowed(toEmail)) {
      log.status = 'STUB'
      log.errorMessage = `Bỏ qua SMTP — không nằm trong SMTP_ALLOWLIST (test).`
      await log.save()
      return log
    }

    try {
      await MailService.send({
        to: toEmail,
        subject: opts.subject,
        text: opts.body,
        html: opts.html,
      })
      log.status = 'SENT'
      log.errorMessage = null
      await log.save()
      return log
    } catch (e: any) {
      log.status = 'FAILED'
      log.errorMessage = e?.message || String(e)
      await log.save()
      return log
    }
  }

  /** Gửi tới user theo id (email đăng nhập / công tác). */
  static async sendToUser(
    userId: number,
    subject: string,
    body: string,
    relatedType?: string,
    relatedId?: number
  ) {
    const user = await User.find(userId)
    if (!user?.email) return null
    return this.send({
      toEmail: user.email,
      subject,
      body,
      relatedType,
      relatedId,
    })
  }

  /**
   * @deprecated Dùng send() — giữ alias để không đổi call-site cũ.
   */
  static async logStub(opts: SendEmailOpts) {
    return this.send(opts)
  }

  /**
   * @deprecated Dùng sendToUser() — giữ alias call-site cũ.
   */
  static async logStubToUser(
    userId: number,
    subject: string,
    body: string,
    relatedType?: string,
    relatedId?: number
  ) {
    return this.sendToUser(userId, subject, body, relatedType, relatedId)
  }
}
