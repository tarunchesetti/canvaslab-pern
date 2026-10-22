import type { Metadata } from 'next'
import EditorClient from '../editor/EditorClient'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Reset password — CanvasLab',
  description: 'Choose a new password for your CanvasLab account.',
}

export default function ResetPasswordPage() {
  return <EditorClient />
}
