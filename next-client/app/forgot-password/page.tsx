import type { Metadata } from 'next'
import EditorClient from '../editor/EditorClient'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Forgot password — CanvasLab',
  description: 'Request a password reset link for your CanvasLab account.',
}

export default function ForgotPasswordPage() {
  return <EditorClient />
}
