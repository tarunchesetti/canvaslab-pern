import type { Environment } from './config.js'

export interface TransactionalEmail {
  to: string
  subject: string
  text: string
  html: string
}

export function isEmailConfigured(configuration: Environment): boolean {
  const sendDevConfigured = Boolean(configuration.SEND_API_KEY && configuration.EMAIL_FROM)
  const resendConfigured = Boolean(configuration.RESEND_API_KEY && configuration.EMAIL_FROM)
  const webhookConfigured = Boolean(
    configuration.PASSWORD_RESET_EMAIL_WEBHOOK_URL && configuration.PASSWORD_RESET_EMAIL_WEBHOOK_SECRET,
  )
  return sendDevConfigured || resendConfigured || webhookConfigured
}

export async function sendTransactionalEmail(
  configuration: Environment,
  message: TransactionalEmail,
): Promise<void> {
  // send.dev supports verifying one existing email address as the sender,
  // so a custom domain is not required for low-volume personal projects.
  if (configuration.SEND_API_KEY && configuration.EMAIL_FROM) {
    const response = await fetch('https://api.do.dev/v1/send/emails/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.SEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: configuration.EMAIL_FROM, name: 'CanvasLab' },
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`send.dev email delivery returned HTTP ${response.status}${details ? `: ${details.slice(0, 500)}` : ''}`)
    }
    return
  }

  if (configuration.RESEND_API_KEY && configuration.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: configuration.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`Resend email delivery returned HTTP ${response.status}${details ? `: ${details.slice(0, 500)}` : ''}`)
    }
    return
  }

  if (configuration.PASSWORD_RESET_EMAIL_WEBHOOK_URL && configuration.PASSWORD_RESET_EMAIL_WEBHOOK_SECRET) {
    const response = await fetch(configuration.PASSWORD_RESET_EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configuration.PASSWORD_RESET_EMAIL_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(message),
    })
    if (!response.ok) throw new Error(`Email webhook delivery returned HTTP ${response.status}`)
    return
  }

  throw new Error('Email delivery is not configured')
}
