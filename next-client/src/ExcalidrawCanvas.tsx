"use client"

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Yjs from 'yjs'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((module) => module.Excalidraw),
  {
    ssr: false,
    loading: () => <div className="excalidraw-loading" role="status">Opening drawing canvas…</div>,
  },
)

type SceneElement = { id: string; index?: string; [key: string]: unknown }

type ExcalidrawCanvasProps = {
  document: Yjs.Doc | null
  canEdit: boolean
}

function parseSceneValue(value: string): SceneElement | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'string') {
      return parsed as SceneElement
    }
  } catch {
    // Ignore malformed records instead of preventing the board from opening.
  }
  return null
}

export default function ExcalidrawCanvas({ document, canEdit }: ExcalidrawCanvasProps) {
  const apiRef = useRef<{
    updateScene: (scene: { elements?: never[]; appState?: Record<string, unknown> }) => void
    addFiles: (files: never[]) => void
  } | null>(null)
  const applyingRemoteRef = useRef(false)
  const migrationDocumentRef = useRef<Yjs.Doc | null>(null)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    const root = window.document.documentElement
    const syncTheme = () => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light')
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const applySharedScene = useCallback(() => {
    if (!document) return
    const sharedElements = document.getMap<string>('excalidraw:elements')
    const sharedFiles = document.getMap<string>('excalidraw:files')
    const elements = Array.from(sharedElements.values())
      .map(parseSceneValue)
      .filter((element): element is SceneElement => element !== null)
      .sort((first, second) => String(first.index ?? '').localeCompare(String(second.index ?? '')))
    const files = Array.from(sharedFiles.values()).flatMap((value) => {
      try {
        return [JSON.parse(value) as never]
      } catch {
        return []
      }
    })

    applyingRemoteRef.current = true
    apiRef.current?.updateScene({
      elements: elements as never[],
      appState: { viewModeEnabled: !canEdit },
    })
    if (files.length) apiRef.current?.addFiles(files)
    setReady(true)
    queueMicrotask(() => {
      applyingRemoteRef.current = false
    })
  }, [canEdit, document])

  useEffect(() => {
    if (!document || !ready || !apiRef.current || migrationDocumentRef.current === document) return
    migrationDocumentRef.current = document

    let cancelled = false
    async function migrateLegacyBoard() {
      const sharedElements = document!.getMap<string>('excalidraw:elements')
      const metadata = document!.getMap<string>('excalidraw:meta')
      if (sharedElements.size > 0 || metadata.get('legacyNodesMigrated') === 'v1') return

      const legacyNodesMap = document!.getMap<Yjs.Map<unknown>>('nodes')
      const { readNodesFromDocument } = await import('./collaboration-state')
      const legacyNodes = readNodesFromDocument(legacyNodesMap)
      if (legacyNodes.length === 0 || cancelled) return

      const skeletons: Record<string, unknown>[] = []
      for (const node of legacyNodes) {
        const data = node.data
        const x = node.position.x
        const y = node.position.y
        const width = Math.max(1, data.width ?? 240)
        const height = Math.max(1, data.height ?? 160)
        const label = [data.title, data.text].filter(Boolean).join('\n\n')

        if (node.type === 'drawing' && data.path) {
          const points = [...data.path.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
            .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
          for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1]
            const end = points[index]
            skeletons.push({
              type: 'line',
              x: x + start.x,
              y: y + start.y,
              width: end.x - start.x,
              height: end.y - start.y,
              strokeColor: data.strokeColor ?? '#343830',
              strokeWidth: data.strokeWidth ?? 2,
            })
          }
          continue
        }

        if (node.type === 'shape') {
          skeletons.push({
            type: data.shape === 'circle' ? 'ellipse' : data.shape === 'diamond' ? 'diamond' : 'rectangle',
            x, y, width, height,
            backgroundColor: data.backgroundColor ?? '#ffffff',
            strokeColor: data.textColor ?? '#343830',
            label: { text: label, fontSize: data.fontSize ?? 16 },
          })
        } else if (node.type === 'note') {
          skeletons.push({
            type: 'stickynote', x, y, width, height,
            backgroundColor: data.backgroundColor ?? '#fff3bf',
            label: { text: label, fontSize: data.fontSize ?? 16, strokeColor: data.textColor ?? '#343830' },
          })
        } else {
          skeletons.push({
            type: 'text', x, y, text: label || ' ',
            fontSize: data.fontSize ?? (node.type === 'code' ? 14 : 18),
            strokeColor: data.textColor ?? '#343830',
          })
        }
      }

      if (cancelled || skeletons.length === 0 || sharedElements.size > 0) return
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
      const elements = convertToExcalidrawElements(skeletons as never[], { regenerateIds: false })
      if (cancelled || sharedElements.size > 0) return

      document!.transact(() => {
        for (const element of elements) {
          sharedElements.set(element.id, JSON.stringify(element))
        }
        metadata.set('legacyNodesMigrated', 'v1')
      })
      // This was a local Yjs transaction, so the observer intentionally skips it.
      // Apply the migrated scene once after writing it so legacy boards appear immediately.
      applySharedScene()
    }

    void migrateLegacyBoard().catch((error: unknown) => {
      console.error('Could not migrate legacy CanvasLab board to Excalidraw', error)
      migrationDocumentRef.current = null
    })

    return () => { cancelled = true }
  }, [applySharedScene, document, ready])

  useEffect(() => {
    if (!document) {
      setReady(false)
      return
    }

    const sharedElements = document.getMap<string>('excalidraw:elements')
    const sharedFiles = document.getMap<string>('excalidraw:files')
    // Local edits are already rendered by Excalidraw. Re-applying the shared scene
    // for every local pointer update interrupts in-progress strokes and leaves a dot.
    // Only apply changes that arrived from another Yjs client.
    const onSharedChange = (_event: unknown, transaction: Yjs.Transaction) => {
      if (!transaction.local) applySharedScene()
    }
    sharedElements.observe(onSharedChange)
    sharedFiles.observe(onSharedChange)
    applySharedScene()

    return () => {
      sharedElements.unobserve(onSharedChange)
      sharedFiles.unobserve(onSharedChange)
    }
  }, [applySharedScene, document])

  const handleChange = useCallback((elements: readonly { id: string; index?: string }[], _appState: unknown, files: Record<string, unknown>) => {
    if (!document || !canEdit || applyingRemoteRef.current) return

    const sharedElements = document.getMap<string>('excalidraw:elements')
    const sharedFiles = document.getMap<string>('excalidraw:files')
    const nextIds = new Set(elements.map((element) => element.id))
    document.transact(() => {
      for (const id of sharedElements.keys()) {
        if (!nextIds.has(id)) sharedElements.delete(id)
      }
      for (const element of elements) {
        const serialized = JSON.stringify(element)
        if (sharedElements.get(element.id) !== serialized) sharedElements.set(element.id, serialized)
      }
      for (const [id, file] of Object.entries(files)) {
        const serialized = JSON.stringify(file)
        if (sharedFiles.get(id) !== serialized) sharedFiles.set(id, serialized)
      }
    })
  }, [canEdit, document])

  return (
    <div className="excalidraw-host" aria-label="Excalidraw drawing canvas">
      {!document && <div className="excalidraw-loading" role="status">Waiting for board collaboration to connect…</div>}
      {document && (
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api as unknown as NonNullable<typeof apiRef.current>
            applySharedScene()
          }}
          viewModeEnabled={!canEdit}
          theme={theme}
          onChange={handleChange}
          initialData={{ appState: { viewModeEnabled: !canEdit, viewBackgroundColor: theme === 'dark' ? '#1b201c' : '#fafaf7' } }}
        />
      )}
      {document && !ready && <div className="excalidraw-loading" role="status">Loading saved drawing…</div>}
    </div>
  )
}
