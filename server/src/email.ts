import { randomUUID } from 'node:crypto'
import type { Environment } from './config.js'

export interface TransactionalEmail {
  to: string
  subject: string
  text: string
  html: string
}

function isGmailConfigured(configuration: Environment): boolean {
  return Boolean(
    configuration.EMAIL_FROM &&
    configuration.GMAIL_CLIENT_ID &&
    configuration.GMAIL_CLIENT_SECRET &&
    configuration.GMAIL_REFRESH_TOKEN,
  )
}

export function isEmailConfigured(configuration: Environment): boolean {
  const webhookConfigured = Boolean(
    configuration.PASSWORD_RESET_EMAIL_WEBHOOK_URL && configuration.PASSWORD_RESET_EMAIL_WEBHOOK_SECRET,
  )
  return isGmailConfigured(configuration) || webhookConfigured
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64Mime(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trim()
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

async function getGmailAccessToken(configuration: Environment): Promise<string> {
  const body = new URLSearchParams({
    client_id: configuration.GMAIL_CLIENT_ID!,
    client_secret: configuration.GMAIL_CLIENT_SECRET!,
    refresh_token: configuration.GMAIL_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const result = await response.json() as { access_token?: string; error?: string; error_description?: string }
  if (!response.ok || !result.access_token) {
    throw new Error(
      `Gmail OAuth token request failed (HTTP ${response.status}): ` +
      `error=${result.error ?? 'unknown'}; ` +
      `description=${result.error_description ?? 'none'}`
    )
  }
  return result.access_token
}

async function sendWithGmail(configuration: Environment, message: TransactionalEmail): Promise<void> {
  const accessToken = await getGmailAccessToken(configuration)
  const boundary = `canvaslab_${randomUUID().replace(/-/g, '')}`
  const safeFrom = configuration.EMAIL_FROM!.replace(/[\r\n<>]/g, '')
  const safeTo = message.to.replace(/[\r\n<>]/g, '')
  const safeSubject = encodeHeader(message.subject.replace(/[\r\n]/g, ''))
  const mimeMessage = [
    `From: CanvasLab <${safeFrom}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Mime(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Mime(message.html),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Url(mimeMessage) }),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Gmail API email delivery returned HTTP ${response.status}${details ? `: ${details.slice(0, 500)}` : ''}`)
  }
}

export async function sendTransactionalEmail(
  configuration: Environment,
  message: TransactionalEmail,
): Promise<void> {
  if (isGmailConfigured(configuration)) {
    await sendWithGmail(configuration, message)
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
