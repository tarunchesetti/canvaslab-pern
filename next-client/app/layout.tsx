import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CanvasLab — Collaborative Whiteboard',
  description: 'A fast, real-time collaborative whiteboard and shared code canvas.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
