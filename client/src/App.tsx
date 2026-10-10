import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  useNodesState,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  Activity,
  ChevronDown,
  Code2,
  Command,
  FilePlus2,
  MousePointer2,
  Plus,
  Search,
  Share2,
  StickyNote,
  Type,
  Users,
} from 'lucide-react'
import '@xyflow/react/dist/style.css'
import './App.css'

type CanvasNode = Node<{
  title: string
  text: string
  tone?: string
}, 'note' | 'code' | 'text'>

const CodeEditor = lazy(() => import('./CodeEditor'))

function NoteCard({ id, data }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <article className={`note-card ${data.tone ?? ''}`}>
      <div className="node-heading">
        <span className="node-grip" aria-hidden="true">⠿</span>
        <span>{data.title}</span>
        <span className="node-dot" />
      </div>
      <textarea
        className="note-input"
        aria-label={`${data.title} note`}
        value={data.text}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div className="node-footer"><span>NOTE</span><span>JUST NOW</span></div>
    </article>
  )
}

function TextCard({ id, data }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <textarea
      className="canvas-text-node nodrag"
      aria-label={`${data.title} text`}
      value={data.text}
      onChange={(event) => updateNodeData(id, { text: event.target.value })}
    />
  )
}

function CodeCard({ id, data }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <article className="code-card">
      <div className="code-heading">
        <div className="code-file"><Code2 size={14} /><span>{data.title}</span></div>
        <span className="language-tag">TS</span>
      </div>
      <Suspense fallback={<div className="editor-loading">Opening editor…</div>}>
        <CodeEditor value={data.text} onChange={(value) => updateNodeData(id, { text: value })} />
      </Suspense>
      <div className="code-footer"><span><span className="green-dot" /> TypeScript</span><span>LOCAL DRAFT</span></div>
    </article>
  )
}

const nodeTypes = { note: NoteCard, code: CodeCard, text: TextCard }

const starterNodes: CanvasNode[] = [
  {
    id: 'idea-1',
    type: 'note',
    position: { x: 110, y: 115 },
    data: { title: 'The problem', text: 'How might a remote team sketch ideas together without losing the thread?', tone: 'note-lemon' },
  },
  {
    id: 'idea-2',
    type: 'note',
    position: { x: 455, y: 365 },
    data: { title: 'One shared space', text: 'Canvas, notes and small code experiments, all moving at the same time.', tone: 'note-coral' },
  },
  {
    id: 'idea-3',
    type: 'note',
    position: { x: 745, y: 105 },
    data: { title: 'The interesting bit', text: 'Two people edit the same block. Both changes survive.', tone: 'note-mint' },
  },
  {
    id: 'code-1',
    type: 'code',
    position: { x: 820, y: 390 },
    data: { title: 'merge-strategy.ts', text: 'const board = createDocument()\n\nboard.on("change", (update) => {\n  persist(update)\n})' },
  },
]

function getInitialNodes(): CanvasNode[] {
  const savedBoard = localStorage.getItem('canvaslab:product-jam')
  if (!savedBoard) return starterNodes

  try {
    const parsedBoard: unknown = JSON.parse(savedBoard)
    return Array.isArray(parsedBoard) ? parsedBoard as CanvasNode[] : starterNodes
  } catch {
    return starterNodes
  }
}

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(getInitialNodes())
  const [activeTool, setActiveTool] = useState('select')
  const [nextId, setNextId] = useState(4)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem('canvaslab:product-jam', JSON.stringify(nodes))
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [nodes])

  function addNode(type: 'note' | 'code' | 'text') {
    const id = `node-${nextId}`
    const offset = (nextId % 5) * 34
    const newNode: CanvasNode = type === 'note'
      ? {
          id,
          type,
          position: { x: 190 + offset, y: 215 + offset },
          data: { title: 'New thought', text: 'Write an idea…', tone: 'note-lemon' },
        }
      : type === 'text'
        ? {
            id,
            type,
            position: { x: 300 + offset, y: 150 + offset },
            data: { title: 'Text', text: 'Type something…' },
          }
        : {
          id,
          type,
          position: { x: 520 + offset, y: 190 + offset },
          data: { title: 'untitled.ts', text: '// Start sketching here' },
        }

    setNodes((currentNodes) => [...currentNodes, newNode])
    setNextId((currentId) => currentId + 1)
    setActiveTool('select')
  }

  async function shareBoard() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#board" aria-label="CanvasLab home">
          <span className="brand-mark"><Command size={17} strokeWidth={2.5} /></span>
          <span>canvas<span className="brand-light">lab</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">F</span>
          <span className="workspace-copy"><strong>Fieldnotes Studio</strong><small>Free workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <button className="nav-item nav-active"><span className="nav-glyph grid-glyph">▦</span> All boards <span className="nav-count">4</span></button>
        <button className="nav-item"><Users size={16} /> Shared with me</button>
        <div className="sidebar-label boards-label">RECENT BOARDS <button aria-label="Create board"><Plus size={15} /></button></div>
        <button className="board-link selected-board"><span className="board-color color-lilac" /> Product jam <span className="board-presence" /></button>
        <button className="board-link"><span className="board-color color-sky" /> Onboarding flow</button>
        <button className="board-link"><span className="board-color color-peach" /> Q4 launch map</button>
        <button className="board-link"><span className="board-color color-green" /> API brainstorm</button>
        <div className="sidebar-bottom">
          <div className="profile-avatar">TC</div>
          <span className="profile-copy"><strong>Tarun C.</strong><small>Personal account</small></span>
          <button className="icon-button profile-menu" aria-label="Account menu"><ChevronDown size={15} /></button>
        </div>
      </aside>

      <section className="workspace" id="board">
        <header className="topbar">
          <div className="breadcrumbs"><span>Boards</span><span className="breadcrumb-slash">/</span><strong>Product jam</strong><span className="private-tag">PRIVATE</span></div>
          <div className="topbar-actions">
            <span className="local-badge">SOLO PREVIEW</span>
            <button className="button button-outline invite-button" disabled title="Invitations are added with the collaboration API"><Users size={15} /> Invite</button>
            <button className="button button-dark" onClick={shareBoard}><Share2 size={15} /> {copied ? 'Copied' : 'Share'}</button>
          </div>
        </header>

        <div className="board-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> TEAM WORKSPACE <span className="heading-dot">·</span> OCT 10, 2026</div><h1>Product jam <button className="title-chevron" aria-label="Board options"><ChevronDown size={16} /></button></h1><p>Shape the next version of how we think together.</p></div>
          <div className="board-status"><span className="status-pulse" /> Local only <span className="status-divider" /> <Activity size={14} /> Changes saved on this device</div>
        </div>

        <div className="board-canvas-wrap">
          <div className="canvas-toolbar" aria-label="Canvas tools">
            <button className={`tool-button ${activeTool === 'select' ? 'tool-selected' : ''}`} title="Select and move" aria-label="Select and move" onClick={() => setActiveTool('select')}><MousePointer2 size={17} /></button>
            <span className="tool-divider" />
            <button className={`tool-button ${activeTool === 'note' ? 'tool-selected' : ''}`} title="Add sticky note" aria-label="Add sticky note" onClick={() => { setActiveTool('note'); addNode('note') }}><StickyNote size={17} /></button>
            <button className={`tool-button ${activeTool === 'text' ? 'tool-selected' : ''}`} title="Add text" aria-label="Add text" onClick={() => { setActiveTool('text'); addNode('text') }}><Type size={17} /></button>
            <button className={`tool-button ${activeTool === 'code' ? 'tool-selected' : ''}`} title="Add code block" aria-label="Add code block" onClick={() => { setActiveTool('code'); addNode('code') }}><Code2 size={17} /></button>
            <span className="tool-divider" />
            <button className="tool-button" title="More canvas tools" aria-label="More canvas tools"><Plus size={17} /></button>
          </div>

          <div className="canvas-search"><Search size={15} /><span>Find on canvas</span><kbd>⌘ K</kbd></div>
          <div className="canvas-live"><span className="live-indicator" /><span>Solo board</span></div>
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            minZoom={0.35}
            maxZoom={1.4}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d8d9d5" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
          <div className="canvas-hint"><MousePointer2 size={13} /> Drag anything to make room for a new idea</div>
          <div className="minimap-preview"><div className="mini-note mini-one" /><div className="mini-note mini-two" /><div className="mini-note mini-three" /><div className="mini-code" /></div>
        </div>

        <footer className="workspace-footer"><span><span className="footer-dot" /> Board ready</span><span>100%</span><span className="footer-separator" /><span>{nodes.length} objects</span><button className="footer-shortcut"><FilePlus2 size={13} /> New board</button></footer>
      </section>
    </main>
  )
}

export default App
