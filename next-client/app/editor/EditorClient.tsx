'use client'

import dynamic from 'next/dynamic'

type AuthMode = 'login' | 'forgot' | 'reset'

const CanvasLabApp = dynamic(() => import('../../src/App'), {
  ssr: false,
  loading: () => (
    <main className="startup-screen">
      <span className="brand-mark" aria-hidden="true">C</span>
      <p>Loading CanvasLab editor…</p>
    </main>
  ),
})

export default function EditorClient({ authMode }: { authMode?: AuthMode }) {
  return <CanvasLabApp authMode={authMode} />
}
