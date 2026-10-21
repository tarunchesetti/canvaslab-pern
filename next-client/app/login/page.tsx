import type { Metadata } from 'next'
import EditorClient from '../editor/EditorClient'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Sign in — CanvasLab',
  description: 'Sign in or create an account to open your CanvasLab workspace.',
}

export default function LoginPage() {
  // The route shell is statically generated. The existing authentication flow
  // remains client-side because it uses browser state and interactive forms.
  return <EditorClient />
}
