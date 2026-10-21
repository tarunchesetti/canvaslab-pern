import type { Metadata } from 'next'
import '../src/App.css'
import '../src/CollaborationPanel.css'
import '../src/TemplateGallery.css'
import '@xyflow/react/dist/style.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'CanvasLab — Collaborative Whiteboard',
  description: 'A real-time collaborative whiteboard and shared code canvas.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
