'use client'

import dynamic from 'next/dynamic'

const CanvasLabApp = dynamic(() => import('../../src/App'), {
  ssr: false,
  loading: () => (
    <main className="startup-screen">
      <span className="brand-mark" aria-hidden="true">C</span>
      <p>Loading CanvasLab editor…</p>
    </main>
  ),
})

export default function EditorClient() {
  return <CanvasLabApp />
}
