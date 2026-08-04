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

  /** Đủ cấu hình để gửi SMTP thật */
  static isConfigured(): boolean {
    // SMTP_ENABLED=false → tắt gửi dù đã có host/user
    if (env.get('SMTP_ENABLED') === false) return false
    const host = (env.get('SMTP_HOST') || '').trim()
    const user = (env.get('SMTP_USER') || '').trim()
    const pass = (env.get('SMTP_PASSWORD') || '').trim()
    return Boolean(host && user && pass)
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
      tls: {
        minVersion: 'TLSv1.2',
      },
    })
    return this.transporter
  }

  /** Gửi 1 email. Ném lỗi nếu SMTP thất bại. */
  static async send(payload: SendMailPayload): Promise<{ messageId?: string }> {
    if (!this.isConfigured()) {
      throw new Error('SMTP_NOT_CONFIGURED')
    }
    const transporter = this.getTransporter()
    const info = await transporter.sendMail({
      from: this.getFromAddress(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || undefined,
    })
    return { messageId: info.messageId }
  }

  static resetTransporter() {
    this.transporter = null
  }
}
