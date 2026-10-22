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
  const [ready, setReady] = useState(false)

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
    if (!document) {
      setReady(false)
      return
    }

    const sharedElements = document.getMap<string>('excalidraw:elements')
    const sharedFiles = document.getMap<string>('excalidraw:files')
    const onSharedChange = () => applySharedScene()
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
          onChange={handleChange}
          initialData={{ appState: { viewModeEnabled: !canEdit } }}
        />
      )}
      {document && !ready && <div className="excalidraw-loading" role="status">Loading saved drawing…</div>}
    </div>
  )
}
