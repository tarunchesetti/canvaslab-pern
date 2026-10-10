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
  ArrowRight,
  ChevronDown,
  Code2,
  Command,
  FilePlus2,
  LoaderCircle,
  MousePointer2,
  Plus,
  Search,
  Share2,
  StickyNote,
  Type,
  Users,
} from 'lucide-react'
import { ApiError, createBoard, getBoards, getCurrentUser, signIn, signOut, signUp, type Board, type User } from './api'
import '@xyflow/react/dist/style.css'
import './App.css'

type CanvasNode = Node<{
  title: string
  text: string
  tone?: string
  readOnly?: boolean
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
        readOnly={data.readOnly}
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
      readOnly={data.readOnly}
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
        <CodeEditor value={data.text} readOnly={data.readOnly} onChange={(value) => updateNodeData(id, { text: value })} />
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

function getInitialNodes(boardId: string, readOnly: boolean): CanvasNode[] {
  const savedBoard = localStorage.getItem(`canvaslab:board:${boardId}`)
  if (!savedBoard) return starterNodes.map((node) => ({ ...node, data: { ...node.data, readOnly } }))

  try {
    const parsedBoard: unknown = JSON.parse(savedBoard)
    const boardNodes = Array.isArray(parsedBoard) ? parsedBoard as CanvasNode[] : starterNodes
    return boardNodes.map((node) => ({ ...node, data: { ...node.data, readOnly } }))
  } catch {
    return starterNodes.map((node) => ({ ...node, data: { ...node.data, readOnly } }))
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authPending, setAuthPending] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser) })
      .catch((error: unknown) => {
        if (active && (!(error instanceof ApiError) || error.status !== 401)) {
          setAuthError(error instanceof Error ? error.message : 'CanvasLab API is unavailable.')
        }
      })
      .finally(() => { if (active) setAuthPending(false) })

    return () => { active = false }
  }, [])

  if (authPending) return <StartupScreen message="Checking your session…" />
  if (!user) return <AuthScreen onAuthenticated={setUser} initialError={authError} />
  return <BoardWorkspace key={user.id} user={user} onLogout={() => setUser(null)} />
}

function StartupScreen({ message }: { message: string }) {
  return <main className="startup-screen"><span className="brand-mark"><Command size={17} /></span><LoaderCircle className="loading-icon" size={19} /><p>{message}</p></main>
}

function AuthScreen({ onAuthenticated, initialError }: { onAuthenticated: (user: User) => void; initialError: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const currentUser = mode === 'register'
        ? await signUp(displayName, email, password)
        : await signIn(email, password)
      onAuthenticated(currentUser)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-side">
        <a className="brand auth-brand" href="#"><span className="brand-mark"><Command size={17} strokeWidth={2.5} /></span><span>canvas<span className="brand-light">lab</span></span></a>
        <div className="auth-story">
          <div className="eyebrow"><span className="eyebrow-line" /> A SHARED SPACE FOR THINKING</div>
          <h1>Good ideas<br />get better<br /><span>together.</span></h1>
          <p>Sketch the rough version. Work through the details. Keep every voice in the room.</p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-grid" />
            <div className="art-note art-note-yellow">Start with<br />a question</div>
            <div className="art-note art-note-green">What if we<br />built it live?</div>
            <div className="art-code"><span>const idea =</span><br /><strong>collaboration</strong><br /><span>× curiosity</span></div>
            <div className="art-cursor"><span /> Jae</div>
          </div>
        </div>
        <div className="auth-footnote">CANVASLAB <span>·</span> THINK IN THE OPEN</div>
      </div>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="brand-mark"><Command size={17} /></span><span>canvas<span className="brand-light">lab</span></span></div>
          <div className="auth-kicker">YOUR WORKSPACE</div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Make room for ideas'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Sign in to pick up where your team left off.' : 'Create an account to start a shared canvas.'}</p>
          <div className="auth-mode-switch" role="tablist" aria-label="Account action">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('login'); setError('') }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('register'); setError('') }}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && <label>Name<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} placeholder="How should we call you?" /></label>}
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' ? 12 : 1} maxLength={72} placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'} /></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Connecting…' : mode === 'login' ? 'Sign in to CanvasLab' : 'Create your account'}
              {submitting ? <LoaderCircle className="loading-icon" size={16} /> : <ArrowRight size={16} />}
            </button>
          </form>
          <div className="auth-security">Your boards are private until you invite someone.</div>
        </div>
        <div className="auth-panel-footer"><span>CANVASLAB 0.1</span><span>BUILT FOR BETTER BRAINSTORMS</span></div>
      </section>
    </main>
  )
}

function BoardWorkspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [boards, setBoards] = useState<Board[]>([])
  const [activeBoardId, setActiveBoardId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [creating, setCreating] = useState(false)

  async function loadBoards(showLoading = false) {
    if (showLoading) {
      setLoading(true)
      setError('')
    }
    try {
      const userBoards = await getBoards()
      setBoards(userBoards)
      setError('')
      setActiveBoardId((currentId) => userBoards.some((board) => board.id === currentId) ? currentId : userBoards[0]?.id ?? '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load boards.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getBoards()
      .then((userBoards) => {
        if (!active) return
        setBoards(userBoards)
        setError('')
        const requestedBoardId = new URLSearchParams(window.location.search).get('board')
        const requestedBoard = userBoards.find((board) => board.id === requestedBoardId)
        setActiveBoardId((currentId) => requestedBoard?.id ?? (userBoards.some((board) => board.id === currentId) ? currentId : userBoards[0]?.id ?? ''))
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load boards.')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  async function handleLogout() {
    try {
      await signOut()
    } catch (logoutError) {
      console.error('Could not invalidate the server session', logoutError)
    } finally {
      onLogout()
    }
  }

  function selectBoard(boardId: string) {
    setActiveBoardId(boardId)
    const url = new URL(window.location.href)
    url.searchParams.set('board', boardId)
    window.history.replaceState(null, '', url)
  }

  async function handleCreateBoard(title: string) {
    setCreating(true)
    setError('')
    try {
      const board = await createBoard(title)
      setBoards((currentBoards) => [board, ...currentBoards])
      selectBoard(board.id)
      setShowCreateBoard(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create board.')
    } finally {
      setCreating(false)
    }
  }

  const activeBoard = boards.find((board) => board.id === activeBoardId)
  if (loading) return <StartupScreen message="Loading your boards…" />
  if (error && boards.length === 0) return <WorkspaceError message={error} onRetry={() => void loadBoards(true)} onLogout={() => void handleLogout()} />
  if (!activeBoard) {
    return <EmptyWorkspace user={user} error={error} onCreateBoard={() => setShowCreateBoard(true)} onLogout={() => void handleLogout()} createDialog={showCreateBoard && <CreateBoardDialog onClose={() => setShowCreateBoard(false)} onCreate={handleCreateBoard} busy={creating} />} />
  }

  return (
    <>
      <BoardCanvas key={activeBoard.id} board={activeBoard} boards={boards} user={user} onSelectBoard={selectBoard} onCreateBoard={() => setShowCreateBoard(true)} onLogout={() => void handleLogout()} />
      {showCreateBoard && <CreateBoardDialog onClose={() => setShowCreateBoard(false)} onCreate={handleCreateBoard} busy={creating} />}
      {error && <div className="api-toast" role="status">{error}</div>}
    </>
  )
}

function WorkspaceError({ message, onRetry, onLogout }: { message: string; onRetry: () => void; onLogout: () => void }) {
  return <main className="workspace-state"><div className="state-mark"><Command size={20} /></div><p className="auth-kicker">CANVASLAB API</p><h1>We couldn’t load your boards.</h1><p className="state-message">{message}</p><div className="state-actions"><button className="auth-submit" onClick={onRetry}>Try again <ArrowRight size={16} /></button><button className="button button-outline" onClick={onLogout}>Sign out</button></div></main>
}

function EmptyWorkspace({ user, error, onCreateBoard, onLogout, createDialog }: { user: User; error: string; onCreateBoard: () => void; onLogout: () => void; createDialog: React.ReactNode }) {
  return (
    <main className="empty-shell">
      <header className="empty-topbar"><a className="brand" href="#"><span className="brand-mark"><Command size={17} /></span><span>canvas<span className="brand-light">lab</span></span></a><button className="button button-outline" onClick={onLogout}>Sign out · {user.displayName}</button></header>
      <section className="empty-content"><div className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</div><h1>A blank canvas<br />is a good place to start.</h1><p>Create a board to bring a thought, a team, or a tricky problem into focus.</p>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit empty-create" onClick={onCreateBoard}><Plus size={16} /> Create your first board</button><div className="empty-art" aria-hidden="true"><div className="empty-grid" /><span className="empty-note note-one">A question<br />worth asking</span><span className="empty-note note-two">Start messy.<br />Get somewhere.</span><span className="empty-code">ideas.ts</span></div></section>
      {createDialog}
    </main>
  )
}

function CreateBoardDialog({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (title: string) => Promise<void>; busy: boolean }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setError('')
    await onCreate(title.trim())
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-board-title">
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="state-mark"><Plus size={19} /></div><p className="auth-kicker">NEW BOARD</p><h2 id="create-board-title">Start with a name.</h2><p className="auth-subtitle">You can change it whenever the idea evolves.</p>
        <form className="auth-form" onSubmit={handleSubmit}><label>Board name<input autoFocus autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="e.g. Product jam" /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create board'}<ArrowRight size={16} /></button></form>
      </section>
    </div>
  )
}

function BoardCanvas({
  board,
  boards,
  user,
  onSelectBoard,
  onCreateBoard,
  onLogout,
}: {
  board: Board
  boards: Board[]
  user: User
  onSelectBoard: (boardId: string) => void
  onCreateBoard: () => void
  onLogout: () => void
}) {
  const canEdit = board.role !== 'viewer'
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(getInitialNodes(board.id, !canEdit))
  const [activeTool, setActiveTool] = useState('select')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(`canvaslab:board:${board.id}`, JSON.stringify(nodes))
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [board.id, nodes])

  function addNode(type: 'note' | 'code' | 'text') {
    const id = `node-${crypto.randomUUID()}`
    const offset = (nodes.length % 5) * 34
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
    setActiveTool('select')
  }

  async function shareBoard() {
    try {
      const boardUrl = new URL(window.location.href)
      boardUrl.searchParams.set('board', board.id)
      await navigator.clipboard.writeText(boardUrl.toString())
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
          <span className="workspace-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <button className="nav-item nav-active"><span className="nav-glyph grid-glyph">▦</span> All boards <span className="nav-count">{boards.length}</span></button>
        <button className="nav-item"><Users size={16} /> Shared with me</button>
        <div className="sidebar-label boards-label">YOUR BOARDS <button aria-label="Create board" onClick={onCreateBoard}><Plus size={15} /></button></div>
        {boards.slice(0, 8).map((item, index) => (
          <button key={item.id} className={`board-link ${item.id === board.id ? 'selected-board' : ''}`} onClick={() => onSelectBoard(item.id)}>
            <span className={`board-color ${['color-lilac', 'color-sky', 'color-peach', 'color-green'][index % 4]}`} />
            <span className="board-link-title">{item.title}</span>
            {item.id === board.id && <span className="board-presence" />}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="profile-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
          <span className="profile-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span>
          <button className="icon-button profile-menu" aria-label="Sign out" title="Sign out" onClick={onLogout}><ChevronDown size={15} /></button>
        </div>
      </aside>

      <section className="workspace" id="board">
        <header className="topbar">
          <div className="breadcrumbs"><span>Boards</span><span className="breadcrumb-slash">/</span><strong>{board.title}</strong><span className="private-tag">{board.role.toUpperCase()}</span></div>
          <div className="topbar-actions">
            <span className="local-badge">SOLO PREVIEW</span>
            <button className="button button-outline invite-button" disabled title="Invitations are added with the collaboration API"><Users size={15} /> Invite</button>
            <button className="button button-dark" onClick={shareBoard}><Share2 size={15} /> {copied ? 'Copied' : 'Share'}</button>
          </div>
        </header>

        <div className="board-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> CANVAS BOARD <span className="heading-dot">·</span> {new Date(board.updated_at).toLocaleDateString()}</div><h1>{board.title} <button className="title-chevron" aria-label="Board options"><ChevronDown size={16} /></button></h1><p>Shape the next version of how we think together.</p></div>
          <div className="board-status"><span className="status-pulse" /> {canEdit ? 'Local only' : 'Read-only'} <span className="status-divider" /> <Activity size={14} /> {canEdit ? 'Changes saved on this device' : 'Viewing this board'}</div>
        </div>

        <div className="board-canvas-wrap">
          <div className="canvas-toolbar" aria-label="Canvas tools">
            <button className={`tool-button ${activeTool === 'select' ? 'tool-selected' : ''}`} title="Select and move" aria-label="Select and move" onClick={() => setActiveTool('select')}><MousePointer2 size={17} /></button>
            <span className="tool-divider" />
            <button className={`tool-button ${activeTool === 'note' ? 'tool-selected' : ''}`} disabled={!canEdit} title="Add sticky note" aria-label="Add sticky note" onClick={() => { setActiveTool('note'); addNode('note') }}><StickyNote size={17} /></button>
            <button className={`tool-button ${activeTool === 'text' ? 'tool-selected' : ''}`} disabled={!canEdit} title="Add text" aria-label="Add text" onClick={() => { setActiveTool('text'); addNode('text') }}><Type size={17} /></button>
            <button className={`tool-button ${activeTool === 'code' ? 'tool-selected' : ''}`} disabled={!canEdit} title="Add code block" aria-label="Add code block" onClick={() => { setActiveTool('code'); addNode('code') }}><Code2 size={17} /></button>
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
            nodesDraggable={canEdit}
            nodesConnectable={false}
            elementsSelectable
            deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d8d9d5" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
          <div className="canvas-hint"><MousePointer2 size={13} /> Drag anything to make room for a new idea</div>
          <div className="minimap-preview"><div className="mini-note mini-one" /><div className="mini-note mini-two" /><div className="mini-note mini-three" /><div className="mini-code" /></div>
        </div>

        <footer className="workspace-footer"><span><span className="footer-dot" /> Board ready</span><span>100%</span><span className="footer-separator" /><span>{nodes.length} objects</span><button className="footer-shortcut" onClick={onCreateBoard}><FilePlus2 size={13} /> New board</button></footer>
      </section>
    </main>
  )
}

export default App
