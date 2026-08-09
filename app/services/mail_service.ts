import nodemailer from 'nodemailer'
import env from '#start/env'

export type SendMailPayload = {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Gửi email qua SMTP (Office 365 / SMTP chung).
 * Cấu hình trong .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ...
 */
export default class MailService {
  private static transporter: nodemailer.Transporter | null = null

  /**
   * Có được phép gửi SMTP thật không.
   * Opt-in: bắt buộc SMTP_ENABLED=true (+ đủ host/user/pass).
   * Kiểm thử: đặt SMTP_ENABLED=false → chỉ ghi log STUB, không gửi.
   */
  static isConfigured(): boolean {
    // Chỉ gửi khi bật cờ rõ ràng — tránh gửi nhầm khi test
    if (env.get('SMTP_ENABLED') !== true) return false
    const host = (env.get('SMTP_HOST') || '').trim()
    const user = (env.get('SMTP_USER') || '').trim()
    const pass = (env.get('SMTP_PASSWORD') || '').trim()
    return Boolean(host && user && pass)
  }

  /** Cờ SMTP_ENABLED đang bật? (dù thiếu host vẫn báo đúng trạng thái) */
  static isEnabledFlag(): boolean {
    return env.get('SMTP_ENABLED') === true
  }

  /**
   * Danh sách email được phép gửi thật (lowercase).
   * Rỗng = không giới hạn (production).
   * Có giá trị = chỉ các địa chỉ trong list mới SMTP; còn lại STUB.
   */
  static getAllowlist(): string[] {
    const raw = (env.get('SMTP_ALLOWLIST') || '').trim()
    if (!raw) return []
    return [
      ...new Set(
        raw
          .split(/[,;\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@'))
      ),
    ]
  }

  /** true nếu chưa set allowlist, hoặc email nằm trong allowlist */
  static isRecipientAllowed(toEmail: string): boolean {
    const list = this.getAllowlist()
    if (!list.length) return true
    const to = (toEmail || '').trim().toLowerCase()
    return list.includes(to)
  }

  static getFromAddress(): string {
    const from = (env.get('SMTP_FROM') || '').trim()
    if (from) return from
    return (env.get('SMTP_USER') || '').trim()
  }

  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter

    const host = (env.get('SMTP_HOST') || '').trim()
    const port = Number(env.get('SMTP_PORT') || 587)
    const user = (env.get('SMTP_USER') || '').trim()
    const pass = env.get('SMTP_PASSWORD') || ''
    // Port 587 = STARTTLS (secure=false). Port 465 = TLS trực tiếp (secure=true).
    const secureEnv = env.get('SMTP_SECURE')
    const secure = secureEnv === undefined || secureEnv === null ? port === 465 : Boolean(secureEnv)

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure && port === 587,
      // Tránh treo vô hạn khi SMTP Office 365 không phản hồi
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
      tls: {
        minVersion: 'TLSv1.2',
      },
    })
    return this.transporter
  }

  /** Gửi 1 email. Ném lỗi nếu SMTP thất bại / quá thời gian. */
  static async send(payload: SendMailPayload): Promise<{ messageId?: string }> {
    if (!this.isConfigured()) {
      throw new Error('SMTP_NOT_CONFIGURED')
    }
    const transporter = this.getTransporter()
    const sendPromise = transporter.sendMail({
      from: this.getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || undefined,
    })
    // Timeout cứng — không để job broadcast kẹt 1 mail
    const timeoutMs = 25_000
    const info = await Promise.race([
      sendPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`SMTP_TIMEOUT_${timeoutMs}ms`)), timeoutMs)
      }),
    ])
    return { messageId: info.messageId }
  }

  static resetTransporter() {
    this.transporter = null
  }
}
