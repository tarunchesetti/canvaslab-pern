import type { Metadata } from 'next'
import BoardsClient from './BoardsClient'

export const metadata: Metadata = {
  title: 'Your boards — CanvasLab',
  description: 'Browse, search, and open your CanvasLab boards.',
}

export default function BoardsPage() {
  return <BoardsClient />
}
