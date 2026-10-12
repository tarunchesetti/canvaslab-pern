import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  NodeResizer,
  ReactFlow,
  useReactFlow,
  useNodesState,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  Activity,
  ArrowRight,
  Bold,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Code2,
  Command,
  LogOut,
  Italic,
  ListChecks,
  Pencil,
  Paintbrush,
  Highlighter,
  Eraser,
  LoaderCircle,
  MousePointer2,
  Plus,
  Search,
  Square,
  Circle,
  Diamond,
  StickyNote,
  Trash2,
  Type,
  Users,
} from 'lucide-react'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { acceptBoardInvitation, inviteBoardMember, ApiError, createBoard, deleteBoard, getBoardMembers, getBoards, getCollaborationToken, getCurrentUser, removeBoardMember, requestPasswordReset, completePasswordReset, signIn, signOut, signUp, updateBoard, updateBoardMemberRole, type Board, type BoardMember, type User } from './api'
import type * as Yjs from 'yjs'
import { passwordsMatch } from './auth-validation'
import type { CanvasDocumentNode } from './collaboration-state'
import { CollaborationPanel } from './CollaborationPanel'
import { TemplateGallery, type CanvasTemplateId } from './TemplateGallery'
import '@xyflow/react/dist/style.css'
import './App.css'

type CanvasNode = Node<{
  title: string
  text: string
  tone?: string
  language?: 'typescript' | 'javascript'
  width?: number
  height?: number
  backgroundColor?: string
  textColor?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  shape?: 'rectangle' | 'circle' | 'diamond'
  path?: string
  strokeColor?: string
  strokeWidth?: number
  strokeOpacity?: number
  readOnly?: boolean
}, 'note' | 'code' | 'text' | 'shape' | 'checklist' | 'drawing'>

type CollaborationBridge = Pick<typeof import('./collaboration-state'), 'canvasNodeSignature' | 'readNodesFromDocument' | 'syncNodesToDocument'>

type RemoteCursor = { id: string; name: string; color: string; x: number; y: number }

function CollaborationCursorLayer({ providerRef, wrapperRef, cursors }: {
  providerRef: React.RefObject<HocuspocusProvider | null>
  wrapperRef: React.RefObject<HTMLDivElement | null>
  cursors: RemoteCursor[]
}) {
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow<CanvasNode>()

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handlePointerMove = (event: PointerEvent) => {
      const bounds = wrapper.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      providerRef.current?.awareness?.setLocalStateField('cursor', position)
    }
    const handlePointerLeave = () => providerRef.current?.awareness?.setLocalStateField('cursor', null)
    wrapper.addEventListener('pointermove', handlePointerMove)
    wrapper.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      wrapper.removeEventListener('pointermove', handlePointerMove)
      wrapper.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [providerRef, screenToFlowPosition, wrapperRef])

  const bounds = wrapperRef.current?.getBoundingClientRect()
  if (!bounds) return null
  return (
    <div className="remote-cursor-layer" aria-hidden="true">
      {cursors.map((cursor) => {
        const point = flowToScreenPosition({ x: cursor.x, y: cursor.y })
        return <div key={cursor.id} className="remote-cursor" style={{ left: point.x - bounds.left, top: point.y - bounds.top, color: cursor.color }}>
          <svg width="15" height="18" viewBox="0 0 15 18" fill="currentColor"><path d="M1 1 L1 14 L5 10 L8 16 L11 14 L8 8 L14 8 Z" /></svg>
          <span>{cursor.name}</span>
        </div>
      })}
    </div>
  )
}

const CodeEditor = lazy(() => import('./CodeEditor'))

function NoteCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <article className={`note-card ${data.tone ?? ''}`} style={{ width: data.width ?? 240, height: data.height ?? 170, backgroundColor: data.backgroundColor, color: data.textColor, fontSize: data.fontSize ?? 12, fontWeight: data.bold ? 700 : 400, fontStyle: data.italic ? 'italic' : 'normal' }}>
      <NodeResizer isVisible={Boolean(selected && !data.readOnly)} minWidth={180} minHeight={120} onResizeEnd={(_event, params) => updateNodeData(id, { width: params.width, height: params.height })} />
      <div className="node-heading">
        <span className="node-grip" aria-hidden="true">⠿</span>
        <span>{data.title}</span>
        <span className="node-dot" />
      </div>
      <textarea
        style={{ color: data.textColor, fontSize: data.fontSize ?? 12, fontWeight: data.bold ? 700 : 400, fontStyle: data.italic ? 'italic' : 'normal' }}
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

function TextCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <>
      <NodeResizer isVisible={Boolean(selected && !data.readOnly)} minWidth={140} minHeight={48} onResizeEnd={(_event, params) => updateNodeData(id, { width: params.width, height: params.height })} />
      <textarea
      style={{ width: data.width ?? 230, height: data.height ?? 70, color: data.textColor, fontSize: data.fontSize ?? 15, fontWeight: data.bold ? 700 : 400, fontStyle: data.italic ? 'italic' : 'normal' }}
      className="canvas-text-node nodrag"
      aria-label={`${data.title} text`}
      value={data.text}
      readOnly={data.readOnly}
      onChange={(event) => updateNodeData(id, { text: event.target.value })}
    />
    </>
  )
}

function CodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()

  return (
    <article className="code-card" style={{ width: data.width ?? 290, height: data.height ?? 190 }}>
      <NodeResizer isVisible={Boolean(selected && !data.readOnly)} minWidth={220} minHeight={150} onResizeEnd={(_event, params) => updateNodeData(id, { width: params.width, height: params.height })} />
      <div className="code-heading">
        <div className="code-file"><Code2 size={14} /><span>{data.title}</span></div>
        <label className="language-picker-label">
          <span className="sr-only">Code language</span>
          <select aria-label="Code language" className="language-picker" disabled={data.readOnly} value={data.language ?? 'typescript'} onChange={(event) => updateNodeData(id, { language: event.target.value as 'typescript' | 'javascript' })}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
      </div>
      <Suspense fallback={<div className="editor-loading">Opening editor…</div>}>
        <CodeEditor value={data.text} language={data.language ?? 'typescript'} readOnly={data.readOnly} onChange={(value) => updateNodeData(id, { text: value })} />
      </Suspense>
      <div className="code-footer"><span><span className="green-dot" /> {data.language === 'javascript' ? 'JavaScript' : 'TypeScript'}</span><span>SHARED TEXT</span></div>
    </article>
  )
}

function ShapeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()
  const shape = data.shape ?? 'rectangle'
  return <div className={`shape-card shape-${shape}`} style={{ width: data.width ?? 180, height: data.height ?? 110, backgroundColor: data.backgroundColor ?? '#e4ebff', color: data.textColor ?? '#27314a', fontSize: data.fontSize ?? 14, fontWeight: data.bold ? 700 : 400, fontStyle: data.italic ? 'italic' : 'normal' }}>
    <NodeResizer isVisible={Boolean(selected && !data.readOnly)} minWidth={90} minHeight={70} onResizeEnd={(_event, params) => updateNodeData(id, { width: params.width, height: params.height })} />
    <textarea aria-label="Shape label" className="shape-label nodrag" value={data.text} readOnly={data.readOnly} onChange={(event) => updateNodeData(id, { text: event.target.value })} onPointerDown={(event) => event.stopPropagation()} />
  </div>
}

function DrawingCard({ data }: NodeProps<CanvasNode>) {
  const width = Math.max(1, data.width ?? 1)
  const height = Math.max(1, data.height ?? 1)
  return <svg className="drawing-card" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Freehand drawing">
    <path d={data.path ?? ''} fill="none" stroke={data.strokeColor ?? '#26352a'} strokeWidth={data.strokeWidth ?? 3} strokeOpacity={data.strokeOpacity ?? 1} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function DrawingSurface({ activeTool, color, strokeWidth, onFinish, onEraseAt }: {
  activeTool: string
  color: string
  strokeWidth: number
  onFinish: (points: { x: number; y: number }[], tool: string, color: string, strokeWidth: number) => void
  onEraseAt: (point: { x: number; y: number }) => void
}) {
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow<CanvasNode>()
  const wrapperRef = useRef<SVGSVGElement | null>(null)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const drawing = activeTool === 'pen' || activeTool === 'brush' || activeTool === 'highlighter'
  const erasing = activeTool === 'eraser'
  const bounds = wrapperRef.current?.getBoundingClientRect()
  const previewPoints = points.map((point) => {
    const screen = flowToScreenPosition(point)
    return { x: screen.x - (bounds?.left ?? 0), y: screen.y - (bounds?.top ?? 0) }
  })
  const previewPath = previewPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
    return screenToFlowPosition({ x: event.clientX, y: event.clientY })
  }
  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (erasing) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onEraseAt(pointFromEvent(event)); return }
    if (!drawing) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setPoints([pointFromEvent(event)])
  }
  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (erasing) { onEraseAt(pointFromEvent(event)); return }
    if (points.length === 0 || !drawing) return
    const point = pointFromEvent(event)
    setPoints((current) => [...current, point])
  }
  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return
    const finished = [...points, pointFromEvent(event)]
    onFinish(finished, activeTool, color, strokeWidth)
    setPoints([])
  }

  return <svg ref={wrapperRef} className={drawing || erasing ? 'drawing-surface drawing-active' : 'drawing-surface'} aria-label="Freehand drawing surface"
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={() => setPoints([])}>
    {previewPath && <path d={previewPath} fill="none" stroke={color} strokeWidth={strokeWidth * (activeTool === 'brush' ? 1.6 : 1)} strokeOpacity={activeTool === 'highlighter' ? 0.28 : 1} strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
}

function ChecklistCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow<CanvasNode>()
  const items = data.text.split('\n')
  function updateItem(index: number, value: string) {
    const next = [...items]
    next[index] = value
    updateNodeData(id, { text: next.join('\n') })
  }
  return <article className="checklist-card" style={{ width: data.width ?? 250, minHeight: data.height ?? 170, backgroundColor: data.backgroundColor ?? '#ffffff', color: data.textColor ?? '#343830', fontSize: data.fontSize ?? 12 }}>
    <NodeResizer isVisible={Boolean(selected && !data.readOnly)} minWidth={200} minHeight={120} onResizeEnd={(_event, params) => updateNodeData(id, { width: params.width, height: params.height })} />
    <div className="checklist-heading"><ListChecks size={14} /><input aria-label="Checklist title" value={data.title} readOnly={data.readOnly} onChange={(event) => updateNodeData(id, { title: event.target.value })} onPointerDown={(event) => event.stopPropagation()} /></div>
    <div className="checklist-items">{items.map((item, index) => {
      const checked = /^\s*\[x\]\s*/i.test(item)
      const label = item.replace(/^\s*\[[ x]\]\s*/i, '')
      return <label className={checked ? 'checklist-item is-checked' : 'checklist-item'} key={index}>
        <input type="checkbox" checked={checked} disabled={data.readOnly} onChange={() => updateItem(index, checked ? label : `[x] ${label}`)} />
        <input className="checklist-item-text" aria-label={`Checklist item ${index + 1}`} value={label} readOnly={data.readOnly} placeholder="Add a task…" onChange={(event) => updateItem(index, `${checked ? '[x] ' : '[ ] '}${event.target.value}`)} onPointerDown={(event) => event.stopPropagation()} />
      </label>
    })}</div>
    {!data.readOnly && <button type="button" className="checklist-add nodrag" onClick={() => updateNodeData(id, { text: [...items, '[ ] New task'].join('\n') })}>+ Add item</button>}
  </article>
}

const nodeTypes = { note: NoteCard, code: CodeCard, text: TextCard, shape: ShapeCard, checklist: ChecklistCard, drawing: DrawingCard }

function toCanvasNodes(nodes: CanvasDocumentNode[], readOnly: boolean): CanvasNode[] {
  return nodes.map((node) => ({
    ...node,
    type: node.type as CanvasNode['type'],
    data: { ...node.data, readOnly },
  }))
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
  const resetToken = new URLSearchParams(window.location.search).get('resetToken')
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(() => resetToken ? 'reset' : 'login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setResetUrl('')
    if ((mode === 'register' || mode === 'reset') && !passwordsMatch(password, confirmPassword)) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email)
        setNotice(result.message)
        setResetUrl(result.resetUrl ?? '')
        return
      }
      if (mode === 'reset') {
        if (!resetToken) throw new Error('This password reset link is missing or invalid.')
        const result = await completePasswordReset(resetToken, password)
        setNotice(result.message)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        const url = new URL(window.location.href)
        url.searchParams.delete('resetToken')
        window.history.replaceState(null, '', url)
        return
      }
      const currentUser = mode === 'register'
        ? await signUp(displayName, email, password)
        : await signIn(email, password)
      onAuthenticated(currentUser)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not complete the request.')
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
          <h2>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Make room for ideas' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Sign in to pick up where your team left off.' : mode === 'register' ? 'Create an account to start a shared canvas.' : mode === 'forgot' ? 'We’ll send a reset link if an account matches your email.' : 'Choose a new password for your account.'}</p>
          {(mode === 'login' || mode === 'register') && <div className="auth-mode-switch" role="tablist" aria-label="Account action">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('login'); setError(''); setNotice(''); setPassword(''); setConfirmPassword('') }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab selected' : 'auth-tab'} onClick={() => { setMode('register'); setError(''); setNotice(''); setPassword(''); setConfirmPassword('') }}>Create account</button>
          </div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && <label>Name<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} placeholder="How should we call you?" /></label>}
            {mode !== 'reset' && <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" /></label>}
            {mode !== 'forgot' && <label>Password<div className="password-input-wrap"><input type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' || mode === 'reset' ? 12 : 1} maxLength={72} placeholder={mode === 'register' || mode === 'reset' ? 'At least 12 characters' : 'Your password'} /><button type="button" className="password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
            {(mode === 'register' || mode === 'reset') && <label>Confirm password<div className="password-input-wrap"><input type={confirmPasswordVisible ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={72} placeholder="Re-enter your password" aria-invalid={confirmPassword.length > 0 && !passwordsMatch(password, confirmPassword)} /><button type="button" className="password-toggle" aria-label={confirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={confirmPasswordVisible} onClick={() => setConfirmPasswordVisible((visible) => !visible)}>{confirmPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{confirmPassword.length > 0 && !passwordsMatch(password, confirmPassword) && <span className="auth-field-error" role="alert">Passwords do not match.</span>}</label>}
            {mode === 'login' && <button type="button" className="auth-link" onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>Forgot password?</button>}
            {notice && <div className="auth-notice" role="status">{notice}{resetUrl && <p className="auth-reset-link"><a href={resetUrl}>Open local password reset link</a></p>}</div>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in to CanvasLab' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
              {submitting ? <LoaderCircle className="loading-icon" size={16} /> : <ArrowRight size={16} />}
            </button>
            {(mode === 'forgot' || mode === 'reset') && <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(''); setNotice(''); setPassword(''); setConfirmPassword('') }}>Back to sign in</button>}
          </form>
          <div className="auth-security">Your boards are private to your account.</div>
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
  const [showMembers, setShowMembers] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showBoardList, setShowBoardList] = useState(false)
  const [boardListFilter, setBoardListFilter] = useState<'all' | 'shared' | 'owned'>('all')
  const [boardAction, setBoardAction] = useState<'rename' | 'delete' | null>(null)
  const [updatingBoard, setUpdatingBoard] = useState(false)

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
    async function initializeWorkspace() {
      try {
        const url = new URL(window.location.href)
        const invitationToken = url.searchParams.get('inviteToken')
        let acceptedBoardId: string | null = null
        if (invitationToken) {
          const accepted = await acceptBoardInvitation(invitationToken)
          acceptedBoardId = accepted.boardId
          url.searchParams.delete('inviteToken')
          url.searchParams.set('board', acceptedBoardId)
          window.history.replaceState(null, '', url)
        }
        const userBoards = await getBoards()
        if (!active) return
        setBoards(userBoards)
        setError('')
        const requestedBoardId = acceptedBoardId ?? url.searchParams.get('board')
        const requestedBoard = userBoards.find((board) => board.id === requestedBoardId)
        setActiveBoardId((currentId) => requestedBoard?.id ?? (userBoards.some((board) => board.id === currentId) ? currentId : userBoards[0]?.id ?? ''))
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load boards or accept the invitation.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initializeWorkspace()
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

  async function handleRenameBoard(title: string) {
    if (!activeBoard) return
    setUpdatingBoard(true)
    setError('')
    try {
      const updatedBoard = await updateBoard(activeBoard.id, title)
      setBoards((currentBoards) => currentBoards.map((board) => board.id === updatedBoard.id ? updatedBoard : board))
      setBoardAction(null)
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename board.')
    } finally {
      setUpdatingBoard(false)
    }
  }

  async function handleDeleteBoard() {
    if (!activeBoard) return
    setUpdatingBoard(true)
    setError('')
    try {
      await deleteBoard(activeBoard.id)
      const remainingBoards = boards.filter((board) => board.id !== activeBoard.id)
      setBoards(remainingBoards)
      setBoardAction(null)
      if (remainingBoards[0]) selectBoard(remainingBoards[0].id)
      else setActiveBoardId('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete board.')
    } finally {
      setUpdatingBoard(false)
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
      <BoardCanvas key={activeBoard.id} board={activeBoard} boards={boards} user={user} onSelectBoard={selectBoard} onCreateBoard={() => setShowCreateBoard(true)} onManageMembers={() => setShowMembers(true)} onShowBoards={(filter) => { setBoardListFilter(filter); setShowBoardList(true) }} onEditBoard={setBoardAction} onLogout={() => void handleLogout()} />
      {showCreateBoard && <CreateBoardDialog onClose={() => setShowCreateBoard(false)} onCreate={handleCreateBoard} busy={creating} />}
      {showMembers && <BoardMembersDialog board={activeBoard} currentUserId={user.id} canManage={activeBoard.role === 'owner'} onClose={() => setShowMembers(false)} />}
      {boardAction && activeBoard && <BoardActionDialog mode={boardAction} board={activeBoard} busy={updatingBoard} onClose={() => setBoardAction(null)} onRename={handleRenameBoard} onDelete={() => void handleDeleteBoard()} />}
      {showBoardList && <BoardListDialog boards={boards} filter={boardListFilter} onClose={() => setShowBoardList(false)} onSelect={(id) => { selectBoard(id); setShowBoardList(false) }} onCreate={() => { setShowBoardList(false); setShowCreateBoard(true) }} />}
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
        <form className="auth-form" onSubmit={handleSubmit}><label>Board name<input autoFocus autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="e.g. Planning workshop" /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create board'}<ArrowRight size={16} /></button></form>
      </section>
    </div>
  )
}

function BoardListDialog({
  boards,
  filter,
  onClose,
  onSelect,
  onCreate,
}: {
  boards: Board[]
  filter: 'all' | 'shared' | 'owned'
  onClose: () => void
  onSelect: (boardId: string) => void
  onCreate: () => void
}) {
  const [query, setQuery] = useState('')
  const visibleBoards = boards.filter((board) => {
    const matchesFilter = filter === 'all' || (filter === 'shared' ? board.role !== 'owner' : board.role === 'owner')
    return matchesFilter && board.title.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="create-dialog board-list-dialog" role="dialog" aria-modal="true" aria-labelledby="board-list-title">
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="auth-kicker">WORKSPACE</p><h2 id="board-list-title">{filter === 'all' ? 'All boards' : filter === 'shared' ? 'Shared with me' : 'Your boards'}</h2>
        <label className="board-list-search"><Search size={15} /><input aria-label="Search boards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by board name" /></label>
        {visibleBoards.length > 0
          ? <div className="board-list-results">{visibleBoards.map((board, index) => <button key={board.id} className="board-list-row" onClick={() => onSelect(board.id)}><span className={`board-color ${['color-lilac', 'color-sky', 'color-peach', 'color-green'][index % 4]}`} /><span className="board-list-name">{board.title}<small>Updated {new Date(board.updated_at).toLocaleDateString()}</small></span><span className="board-list-role">{board.role}</span><ArrowRight size={15} /></button>)}</div>
          : <div className="board-list-empty">{filter === 'shared' ? 'Boards shared with you will appear here.' : query ? 'No boards match that search.' : 'No boards yet.'}</div>}
        <button className="board-list-create" onClick={onCreate}><Plus size={15} /> Create a board</button>
      </section>
    </div>
  )
}

function BoardActionDialog({
  mode,
  board,
  busy,
  onClose,
  onRename,
  onDelete,
}: {
  mode: 'rename' | 'delete'
  board: Board
  busy: boolean
  onClose: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => void
}) {
  const [title, setTitle] = useState(board.title)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (title.trim()) await onRename(title.trim())
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="board-action-title">
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="state-mark">{mode === 'rename' ? <Type size={18} /> : <Plus size={18} />}</div>
        <p className="auth-kicker">BOARD SETTINGS</p>
        <h2 id="board-action-title">{mode === 'rename' ? 'Rename this board.' : 'Delete this board?'}</h2>
        {mode === 'rename'
          ? <form className="auth-form board-action-form" onSubmit={handleSubmit}><label>Board name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} /></label><button className="auth-submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save name'}<ArrowRight size={16} /></button></form>
          : <><p className="auth-subtitle">“{board.title}” and its shared canvas document will be removed. This can’t be undone.</p><div className="state-actions"><button className="button button-outline" onClick={onClose}>Keep board</button><button className="danger-button" onClick={onDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete board'}</button></div></>}
      </section>
    </div>
  )
}

function BoardMembersDialog({
  board,
  currentUserId,
  canManage,
  onClose,
}: {
  board: Board
  currentUserId: string
  canManage: boolean
  onClose: () => void
}) {
  const [members, setMembers] = useState<BoardMember[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [invitationLink, setInvitationLink] = useState('')

  useEffect(() => {
    let active = true
    getBoardMembers(board.id)
      .then((loadedMembers) => { if (active) setMembers(loadedMembers) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load board members.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [board.id])

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const invitation = await inviteBoardMember(board.id, email, role)
      setInvitationLink(invitation.invitationUrl)
      setNotice(invitation.emailSent
        ? `Invitation email sent to ${invitation.email}. You can also copy the link below; it expires in ${invitation.expiresInDays} days.`
        : `Invitation created for ${invitation.email}. Email delivery is optional; copy and share the link below. It expires in ${invitation.expiresInDays} days.`)
      setEmail('')
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not send that invitation.')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(member: BoardMember, nextRole: 'editor' | 'viewer') {
    setBusy(true)
    setError('')
    try {
      await updateBoardMemberRole(board.id, member.id, nextRole)
      setMembers((currentMembers) => currentMembers.map((current) => current.id === member.id ? { ...current, role: nextRole } : current))
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Could not update member role.')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member: BoardMember) {
    setBusy(true)
    setError('')
    try {
      await removeBoardMember(board.id, member.id)
      setMembers((currentMembers) => currentMembers.filter((current) => current.id !== member.id))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove member.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="create-dialog members-dialog" role="dialog" aria-modal="true" aria-labelledby="members-title">
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="state-mark"><Users size={18} /></div>
        <p className="auth-kicker">BOARD ACCESS</p>
        <h2 id="members-title">People on this board</h2>
        <p className="auth-subtitle">Enter an email to send a board invitation. CanvasLab will email the secure invite link and keep a copyable link available below.</p>
        {canManage && <form className="auth-form member-add-form" onSubmit={handleAdd}>
          <label>Email address<input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="teammate@example.com" /></label>
          <label>Access<select value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')}><option value="editor">Can edit</option><option value="viewer">Can view</option></select></label>
          <button className="auth-submit" disabled={busy || !email.trim()}>{busy ? 'Sending invitation…' : 'Send invitation'}<ArrowRight size={16} /></button>
        </form>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        {invitationLink && <div className="invitation-link-panel"><label htmlFor="board-invitation-link">Invitation link</label><input id="board-invitation-link" readOnly value={invitationLink} onFocus={(event) => event.currentTarget.select()} /><div className="invitation-link-actions"><button type="button" className="button button-outline" onClick={async () => { try { await navigator.clipboard.writeText(invitationLink); setNotice('Invitation link copied to clipboard.') } catch { setNotice('Select the invitation link above and copy it manually.') } }}>Copy invitation link</button><a href={invitationLink}>Open link</a></div></div>}
        {error && <div className="auth-error members-error" role="alert">{error}</div>}
        <div className="member-list" aria-live="polite">
          {loading ? <div className="member-list-empty">Loading board members…</div> : members.length === 0 ? <div className="member-list-empty">No members found.</div> : members.map((member) => (
            <div className="member-row" key={member.id}>
              <span className="presence-avatar avatar-blue">{member.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="member-identity"><strong>{member.displayName}{member.id === currentUserId ? ' (you)' : ''}</strong><small>{member.email}</small></span>
              {canManage && member.role !== 'owner'
                ? <select aria-label={`Role for ${member.email}`} disabled={busy} value={member.role} onChange={(event) => void changeRole(member, event.target.value as 'editor' | 'viewer')}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                : <span className="board-list-role">{member.role}</span>}
              {canManage && member.role !== 'owner' && member.id !== currentUserId && <button className="member-remove" disabled={busy} onClick={() => void removeMember(member)} aria-label={`Remove ${member.email}`} title="Remove member">×</button>}
            </div>
          ))}
        </div>
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
  onManageMembers,
  onShowBoards,
  onEditBoard,
  onLogout,
}: {
  board: Board
  boards: Board[]
  user: User
  onSelectBoard: (boardId: string) => void
  onCreateBoard: () => void
  onManageMembers: () => void
  onShowBoards: (filter: 'all' | 'shared' | 'owned') => void
  onEditBoard: (mode: 'rename' | 'delete') => void
  onLogout: () => void
}) {
  const canEdit = board.role !== 'viewer'
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([])
  const [activeTool, setActiveTool] = useState('select')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [drawingColor, setDrawingColor] = useState('#26352a')
  const [drawingWidth, setDrawingWidth] = useState(3)
  const [showBoardMenu, setShowBoardMenu] = useState(false)
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false)
  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const selectedNode = nodes.find((node) => node.selected && !node.data.readOnly)
  function updateSelectedNode(patch: Partial<CanvasNode['data']>) {
    if (!selectedNode) return
    setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch } } : node))
  }
  function duplicateSelectedNode() {
    if (!selectedNode) return
    const duplicate: CanvasNode = { ...selectedNode, id: `node-${crypto.randomUUID()}`, position: { x: selectedNode.position.x + 36, y: selectedNode.position.y + 36 }, selected: true, data: { ...selectedNode.data, readOnly: undefined, title: `${selectedNode.data.title} copy` } }
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), duplicate])
  }
  function deleteSelectedNode() {
    if (selectedNode) setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
  }
  const [collaborationStatus, setCollaborationStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [collaborationReady, setCollaborationReady] = useState(false)
  const [collaborationError, setCollaborationError] = useState('')
  const canInteract = canEdit && collaborationReady
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; color: string }[]>([])
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
  const screenToFlowPositionRef = useRef<((position: { x: number; y: number }) => { x: number; y: number }) | null>(null)
  const documentRef = useRef<Yjs.Doc | null>(null)
  const sharedNodesRef = useRef<Yjs.Map<Yjs.Map<unknown>> | null>(null)
  const collaborationBridgeRef = useRef<CollaborationBridge | null>(null)
  const remoteSignatureRef = useRef('')
  const nodesRef = useRef(nodes)
  useLayoutEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    let active = true
    let document: Yjs.Doc | null = null
    let sharedNodes: Yjs.Map<Yjs.Map<unknown>> | null = null
    let provider: HocuspocusProvider | null = null
    let stopObserving: (() => void) | null = null

    async function connect() {
      try {
        const [providerModule, yjs, bridge] = await Promise.all([
          import('@hocuspocus/provider'),
          import('yjs'),
          import('./collaboration-state'),
        ])
        if (!active) return

        document = new yjs.Doc()
        sharedNodes = document.getMap<Yjs.Map<unknown>>('nodes')
        documentRef.current = document
        sharedNodesRef.current = sharedNodes
        collaborationBridgeRef.current = bridge

        const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const socketUrl = import.meta.env.VITE_COLLAB_URL || `${socketProtocol}//${window.location.hostname}:1234`
        provider = new providerModule.HocuspocusProvider({
          url: socketUrl,
          name: board.id,
          document,
          token: getCollaborationToken,
        })
        providerRef.current = provider
        provider.awareness?.setLocalStateField('user', {
          id: user.id,
          name: user.displayName,
          color: '#c78569',
        })

        let documentSynced = false
        function syncFromDocument() {
          if (!sharedNodes) return
          const loadedNodes = toCanvasNodes(bridge.readNodesFromDocument(sharedNodes), !canEdit)
          remoteSignatureRef.current = bridge.canvasNodeSignature(loadedNodes)
          setNodes(loadedNodes)
        }

        function handleDocumentChange() {
          if (active && documentSynced) syncFromDocument()
        }

        sharedNodes.observeDeep(handleDocumentChange)
        stopObserving = () => sharedNodes?.unobserveDeep(handleDocumentChange)
        provider.on('status', ({ status }: { status: string }) => {
          if (active) setCollaborationStatus(status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'offline')
        })
        provider.on('synced', ({ state }: { state: boolean }) => {
          if (!active || !state || !document || !sharedNodes) return
          documentSynced = true
          if (sharedNodes.size === 0 && canEdit) {
            bridge.syncNodesToDocument(document, sharedNodes, nodesRef.current)
          }
          syncFromDocument()
          setCollaborationReady(true)
          setCollaborationStatus('connected')
        })
        provider.on('awarenessUpdate', ({ states }: { states: { clientId: number; user?: { id?: string; name?: string; color?: string }; cursor?: { x?: number; y?: number } | null }[] }) => {
          if (!active) return
          const usersById = new Map<string, { id: string; name: string; color: string }>()
          const cursorsById = new Map<string, RemoteCursor>()
          for (const state of states) {
            const collaborator = state.user
            if (!collaborator?.id || !collaborator.name) continue
            usersById.set(collaborator.id, {
              id: collaborator.id,
              name: collaborator.name,
              color: collaborator.color ?? '#93a17e',
            })
            if (collaborator.id !== user.id && typeof state.cursor?.x === 'number' && typeof state.cursor?.y === 'number') {
              cursorsById.set(collaborator.id, { id: collaborator.id, name: collaborator.name, color: collaborator.color ?? '#93a17e', x: state.cursor.x, y: state.cursor.y })
            }
          }
          setCollaborators([...usersById.values()])
          setRemoteCursors([...cursorsById.values()])
        })
        provider.on('authenticationFailed', ({ reason }: { reason: string }) => {
          if (!active) return
          setCollaborationError(reason || 'Board access was denied.')
          setCollaborationStatus('offline')
        })
      } catch (error) {
        if (!active) return
        setCollaborationError(error instanceof Error ? error.message : 'Could not connect to live collaboration.')
        setCollaborationStatus('offline')
      }
    }

    void connect()

    return () => {
      active = false
      stopObserving?.()
      provider?.destroy()
      providerRef.current = null
      document?.destroy()
      setRemoteCursors([])
      documentRef.current = null
      sharedNodesRef.current = null
      collaborationBridgeRef.current = null
    }
  }, [board.id, canEdit, setNodes, user.displayName, user.id])

  useEffect(() => {
    if (!collaborationReady || !canEdit) return
    const document = documentRef.current
    const sharedNodes = sharedNodesRef.current
    const bridge = collaborationBridgeRef.current
    if (!document || !sharedNodes || !bridge) return

    const signature = bridge.canvasNodeSignature(nodes)
    if (signature === remoteSignatureRef.current) {
      remoteSignatureRef.current = ''
      return
    }
    bridge.syncNodesToDocument(document, sharedNodes, nodes)
  }, [board.id, canEdit, collaborationReady, nodes])

  function addNode(type: 'note' | 'code' | 'text' | 'shape' | 'checklist', shape: 'rectangle' | 'circle' | 'diamond' = 'rectangle') {
    const id = `node-${crypto.randomUUID()}`
    const size = type === 'code' ? { width: 290, height: 190 } : type === 'text' ? { width: 230, height: 70 } : type === 'shape' ? { width: 180, height: 110 } : type === 'checklist' ? { width: 250, height: 170 } : { width: 240, height: 170 }
    let position = { x: 110, y: 115 }
    const canvasBounds = canvasWrapperRef.current?.getBoundingClientRect()
    if (type === 'shape' && canvasBounds && screenToFlowPositionRef.current) {
      const center = screenToFlowPositionRef.current({
        x: canvasBounds.left + canvasBounds.width / 2,
        y: canvasBounds.top + canvasBounds.height / 2,
      })
      position = { x: center.x - size.width / 2, y: center.y - size.height / 2 }
    } else {
      for (let row = 0; row < 20; row += 1) {
        let foundPosition = false
        for (let column = 0; column < 6; column += 1) {
          const candidate = { x: 110 + column * 310, y: 115 + row * 245 }
          const overlapsNode = nodes.some((node) => {
            const nodeSize = node.type === 'code' ? { width: 290, height: 190 } : node.type === 'text' ? { width: 230, height: 70 } : node.type === 'shape' ? { width: node.data.width ?? 180, height: node.data.height ?? 110 } : node.type === 'checklist' ? { width: node.data.width ?? 250, height: node.data.height ?? 170 } : { width: 240, height: 170 }
            return candidate.x < node.position.x + nodeSize.width + 28
              && candidate.x + size.width + 28 > node.position.x
              && candidate.y < node.position.y + nodeSize.height + 28
              && candidate.y + size.height + 28 > node.position.y
          })

          if (!overlapsNode) {
            position = candidate
            foundPosition = true
            break
          }
        }
        if (foundPosition) break
      }
    }

    const newNode: CanvasNode = type === 'note'
      ? { id, type, position, data: { title: 'New thought', text: 'Write an idea…', tone: 'note-lemon', width: size.width, height: size.height } }
      : type === 'text'
        ? { id, type, position, data: { title: 'Text', text: 'Type something…', width: size.width, height: size.height } }
        : type === 'shape'
          ? { id, type, position, data: { title: 'Shape', text: 'Label', shape, backgroundColor: '#e4ebff', textColor: '#27314a', width: size.width, height: size.height } }
          : type === 'checklist'
            ? { id, type, position, data: { title: 'Checklist', text: '[ ] First task\n[ ] Second task', backgroundColor: '#ffffff', width: size.width, height: size.height } }
            : { id, type, position, data: { title: 'untitled.ts', text: '// Start sketching here', language: 'typescript', width: size.width, height: size.height } }

    setNodes((currentNodes) => [...currentNodes.map((node) => ({ ...node, selected: false })), { ...newNode, selected: type === 'shape' }])
    setActiveTool('select')
  }

  function finishDrawing(points: { x: number; y: number }[], tool: string, color: string, width: number) {
    if (!canInteract || points.length < 2) return
    const padding = Math.max(3, width * 2)
    const minX = Math.min(...points.map((point) => point.x)) - padding
    const minY = Math.min(...points.map((point) => point.y)) - padding
    const maxX = Math.max(...points.map((point) => point.x)) + padding
    const maxY = Math.max(...points.map((point) => point.y)) + padding
    const nodeWidth = Math.max(2, maxX - minX)
    const nodeHeight = Math.max(2, maxY - minY)
    const path = points.map((point, index) => {
      const x = point.x - minX
      const y = point.y - minY
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
    const strokeWidth = width * (tool === 'brush' ? 1.6 : tool === 'highlighter' ? 5 : 1)
    const newDrawing: CanvasNode = {
      id: `drawing-${crypto.randomUUID()}`,
      type: 'drawing',
      position: { x: minX, y: minY },
      draggable: true,
      selectable: true,
      data: {
        title: tool === 'highlighter' ? 'Highlighter stroke' : 'Drawing stroke',
        text: '',
        path,
        strokeColor: color,
        strokeWidth,
        strokeOpacity: tool === 'highlighter' ? 0.28 : 1,
        width: nodeWidth,
        height: nodeHeight,
      },
    }
    setNodes((current) => [...current, newDrawing])
  }

  function applyTemplate(templateId: CanvasTemplateId) {
    const templates: Record<CanvasTemplateId, { title: string; text: string; type: CanvasNode['type']; x: number; y: number; color: string }[]> = {
      'meeting-notes': [
        { title: 'Meeting notes', text: 'Meeting title • Date • Attendees', type: 'text', x: 100, y: 50, color: '#303a2b' },
        { title: 'Agenda', text: '1. Topic to discuss\n2. Open questions\n3. Decisions needed', type: 'note', x: 100, y: 150, color: '#e8eedf' },
        { title: 'Discussion', text: 'Key points and context\n\nWhat did we learn?', type: 'note', x: 400, y: 150, color: '#fff0c9' },
        { title: 'Decisions', text: 'Decision • Owner • Why', type: 'note', x: 100, y: 380, color: '#e4eaf8' },
        { title: 'Action items', text: '☐ Action — owner — due date\n☐ Action — owner — due date', type: 'checklist', x: 400, y: 380, color: '#f6e5dc' },
      ],
      'project-proposal': [
        { title: 'Project proposal', text: 'Project name and one-sentence summary', type: 'text', x: 100, y: 50, color: '#303a2b' },
        { title: 'Problem', text: 'Who has this problem?\nWhat evidence do we have?', type: 'note', x: 100, y: 150, color: '#f3e7d7' },
        { title: 'Goals & success', text: 'What will improve?\nHow will we measure success?', type: 'note', x: 400, y: 150, color: '#e5eadb' },
        { title: 'Scope & risks', text: 'In scope\nOut of scope\nMain risks and mitigations', type: 'note', x: 100, y: 380, color: '#e8e4f4' },
        { title: 'Plan & owners', text: 'Milestone • Owner • Target date', type: 'note', x: 400, y: 380, color: '#e0ebf0' },
      ],
      'pitch-deck': [
        { title: '01 · The idea', text: 'A clear one-line description of the product or idea.', type: 'shape', x: 100, y: 70, color: '#e8e4f4' },
        { title: '02 · The problem', text: 'Who is struggling today?\nWhy do current solutions fall short?', type: 'shape', x: 400, y: 70, color: '#e0ebf0' },
        { title: '03 · Our solution', text: 'Show the simplest, strongest version of the solution.', type: 'shape', x: 100, y: 320, color: '#e5eadb' },
        { title: '04 · The plan', text: 'Milestones • Team • Ask', type: 'shape', x: 400, y: 320, color: '#f3e7d7' },
      ],
      'sprint-review': [
        { title: 'Sprint review', text: 'Sprint number • Dates • Team', type: 'text', x: 100, y: 50, color: '#303a2b' },
        { title: 'Shipped', text: 'What went live?\nWhat value did it deliver?', type: 'note', x: 100, y: 150, color: '#e5eadb' },
        { title: 'Learnings', text: 'What worked?\nWhat surprised us?', type: 'note', x: 400, y: 150, color: '#e8e4f4' },
        { title: 'Feedback', text: 'Questions and feedback from stakeholders', type: 'note', x: 100, y: 380, color: '#e0ebf0' },
        { title: 'Next sprint', text: '☐ Priority one\n☐ Priority two\n☐ Priority three', type: 'checklist', x: 400, y: 380, color: '#fff0c9' },
      ],
      'brainstorm': [
        { title: 'Challenge / opportunity', text: 'What question are we trying to answer together?', type: 'shape', x: 400, y: 250, color: '#e8e4f4' },
        { title: 'Ideas', text: 'Add ideas here — one thought per note', type: 'note', x: 80, y: 100, color: '#fff0c9' },
        { title: 'Wild ideas', text: 'What if there were no constraints?', type: 'note', x: 750, y: 100, color: '#f6e5dc' },
        { title: 'Questions', text: 'What do we still need to learn?', type: 'note', x: 80, y: 450, color: '#e0ebf0' },
        { title: 'Next experiments', text: '☐ Test an assumption\n☐ Talk to a user', type: 'checklist', x: 750, y: 450, color: '#e5eadb' },
      ],
      'user-journey': [
        { title: 'Discover', text: 'User actions\nTouchpoints\nQuestions', type: 'shape', x: 80, y: 180, color: '#e0ebf0' },
        { title: 'Evaluate', text: 'User actions\nConfusion / friction\nNeeds', type: 'shape', x: 350, y: 180, color: '#e8e4f4' },
        { title: 'Use', text: 'Key moments\nPain points\nOpportunities', type: 'shape', x: 620, y: 180, color: '#fff0c9' },
        { title: 'Return', text: 'What brings them back?\nHow do we build trust?', type: 'shape', x: 890, y: 180, color: '#e5eadb' },
        { title: 'Journey insights', text: 'Biggest pain point • Best opportunity • What to validate next', type: 'note', x: 350, y: 430, color: '#f6e5dc' },
      ],
    }
    const baseY = nodes.length ? Math.max(...nodes.map((node) => node.position.y + (node.data.height ?? 170))) + 100 : 0
    const additions: CanvasNode[] = templates[templateId].map((item) => ({
      id: 'template-' + crypto.randomUUID(),
      type: item.type,
      position: { x: item.x, y: item.y + baseY },
      data: { title: item.title, text: item.text, width: item.type === 'text' ? 520 : item.type === 'shape' ? 250 : 270, height: item.type === 'text' ? 60 : 170, backgroundColor: item.color, textColor: item.type === 'shape' ? '#303a2b' : undefined, fontSize: item.type === 'text' ? 26 : item.type === 'shape' ? 18 : 12, shape: item.type === 'shape' ? 'rectangle' : undefined },
    }))
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...additions])
    setShowTemplateGallery(false)
    setActiveTool('select')
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
        <a className="brand" href="#board" aria-label="CanvasLab home">
          <span className="brand-mark"><Command size={17} strokeWidth={2.5} /></span>
          <span>canvas<span className="brand-light">lab</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <button className="nav-item nav-active" onClick={() => onShowBoards('all')}><span className="nav-glyph grid-glyph">▦</span> All boards <span className="nav-count">{boards.length}</span></button>
        <button className="nav-item" onClick={() => onShowBoards('shared')}><Users size={16} /> Shared with me</button>
        <div className="sidebar-label boards-label">YOUR BOARDS <button aria-label="Create board" onClick={onCreateBoard}><Plus size={15} /></button></div>
        {boards.slice(0, 8).map((item, index) => (
          <button key={item.id} className={`board-link ${item.id === board.id ? 'selected-board' : ''}`} onClick={() => onSelectBoard(item.id)}>
            <span className={`board-color ${['color-lilac', 'color-sky', 'color-peach', 'color-green'][index % 4]}`} />
            <span className="board-link-title">{item.title}</span>
            {item.id === board.id && <span className="board-presence" />}
          </button>
        ))}
        <div className="sidebar-bottom">
          <button className="button button-outline signout-button" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={14} /><span>Sign out</span></button>
        </div>
      </aside>

      <section className="workspace" id="board">
        <header className="topbar">
          <a className="mobile-brand" href="#board" aria-label="CanvasLab home"><span className="brand-mark"><Command size={17} strokeWidth={2.5} /></span><span>canvas<span className="brand-light">lab</span></span></a><div className="breadcrumbs"><button className="header-all-boards" onClick={() => onShowBoards('all')}><span className="nav-glyph">▦</span><span>All boards</span></button><span className="breadcrumb-slash">/</span><strong>{board.title}</strong><span className="private-tag">{board.role.toUpperCase()}</span></div>
          <div className="topbar-actions">
            {collaborators.length > 0 && <div className="presence-stack" aria-label={`${collaborators.length} collaborators online`}>{collaborators.slice(0, 4).map((collaborator) => <span key={collaborator.id} className="presence-avatar" title={collaborator.name} style={{ backgroundColor: collaborator.color }}>{collaborator.name.slice(0, 1).toUpperCase()}</span>)}</div>}
            <span className="connection-badge">{collaborationStatus === 'connected' ? 'LIVE SYNC' : collaborationStatus === 'offline' ? 'OFFLINE' : 'CONNECTING'}</span>
            <button className="button button-dark header-create-board" onClick={onCreateBoard}><Plus size={16} /><span>New board</span></button>
<button className="button button-outline collab-open-button" onClick={() => setShowCollaborationPanel(true)} title="Comments, tasks, voting, and activity"><Activity size={15} /><span>Collab</span></button><button className="button button-outline invite-button" onClick={onManageMembers}><Users size={15} /> Share</button>
            <button className="button button-outline mobile-signout" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>
          </div>
        </header>
        <nav className="mobile-workspace-nav" aria-label="Workspace navigation">
          <button className="mobile-workspace-link" onClick={() => onShowBoards('all')}><span className="nav-glyph">▦</span><span>All boards</span><span className="nav-count">{boards.length}</span></button>
          <button className="mobile-workspace-link" onClick={() => onShowBoards('shared')}><Users size={15} /><span>Shared with me</span></button>
          <button className="mobile-workspace-link" onClick={() => onShowBoards('owned')}><Command size={15} /><span>Your boards</span></button>
        </nav>
        {mobileNavOpen && <div className="mobile-header-menu">
          <div className="mobile-menu-account"><span className="workspace-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div>
          <button onClick={() => { onShowBoards('all'); setMobileNavOpen(false) }}><span className="nav-glyph">▦</span><span>All boards</span><span className="nav-count">{boards.length}</span></button>
          <button onClick={() => { onShowBoards('shared'); setMobileNavOpen(false) }}><Users size={16} /><span>Shared with me</span></button>
          <div className="mobile-menu-label">YOUR BOARDS <button aria-label="Create board" onClick={() => { setMobileNavOpen(false); onCreateBoard() }}><Plus size={15} /></button></div>
          {boards.slice(0, 8).map((item, index) => <button key={item.id} className={item.id === board.id ? 'mobile-board-current' : ''} onClick={() => { onSelectBoard(item.id); setMobileNavOpen(false) }}><span className={`board-color ${['color-lilac', 'color-sky', 'color-peach', 'color-green'][index % 4]}`} /><span>{item.title}</span></button>)}
          <button className="mobile-menu-signout" onClick={onLogout}><LogOut size={16} /><span>Sign out</span></button>
        </div>}

        <div className="board-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> CANVAS BOARD <span className="heading-dot">·</span> {new Date(board.updated_at).toLocaleDateString()}</div><div className="board-title-line"><h1>{board.title}</h1><button className="title-chevron" aria-label="Board options" aria-expanded={showBoardMenu} onClick={() => setShowBoardMenu((visible) => !visible)}><ChevronDown size={16} /></button>{showBoardMenu && <div className="board-options-menu" role="menu">{canEdit && <button role="menuitem" onClick={() => { setShowBoardMenu(false); onEditBoard('rename') }}>Rename board</button>}{board.role === 'owner' && <button className="menu-danger" role="menuitem" onClick={() => { setShowBoardMenu(false); onEditBoard('delete') }}>Delete board</button>}</div>}</div><p>Shape the next version of how we think together.</p></div>
          <div className="board-status" title={collaborationError || undefined}><span className={`status-pulse ${collaborationStatus === 'offline' ? 'status-offline' : ''}`} /> {collaborationStatus === 'connected' ? canEdit ? 'Live sync' : 'Read-only live' : collaborationStatus === 'offline' ? 'Reconnect needed' : 'Connecting'} <span className="status-divider" /> <Activity size={14} /> {collaborationError || (collaborationStatus === 'connected' ? 'All changes synced' : 'Waiting for board sync')}</div>
        </div>

        <div className={`board-canvas-wrap ${canInteract && ['pen', 'brush', 'highlighter', 'eraser'].includes(activeTool) ? 'drawing-mode' : ''}`} ref={canvasWrapperRef}>
          <div className="canvas-toolbar" aria-label="Canvas tools">
            <button className={`tool-button ${activeTool === 'select' ? 'tool-selected' : ''}`} title="Select and move" aria-label="Select and move" onClick={() => setActiveTool('select')}><MousePointer2 size={17} /></button>
            <button className={`tool-button ${activeTool === 'pen' ? 'tool-selected' : ''}`} disabled={!canInteract} title="Pen: draw freehand" aria-label="Pen tool" onClick={() => setActiveTool('pen')}><Pencil size={17} /></button>
            <button className={`tool-button ${activeTool === 'brush' ? 'tool-selected' : ''}`} disabled={!canInteract} title="Brush: thicker strokes" aria-label="Brush tool" onClick={() => setActiveTool('brush')}><Paintbrush size={17} /></button>
            <button className={`tool-button ${activeTool === 'highlighter' ? 'tool-selected' : ''}`} disabled={!canInteract} title="Highlighter: translucent strokes" aria-label="Highlighter tool" onClick={() => setActiveTool('highlighter')}><Highlighter size={17} /></button>
            <button className={`tool-button ${activeTool === 'eraser' ? 'tool-selected' : ''}`} disabled={!canInteract} title="Eraser: click a drawing stroke to remove it" aria-label="Eraser tool" onClick={() => setActiveTool('eraser')}><Eraser size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add sticky note" aria-label="Add sticky note" onClick={() => { setActiveTool('note'); addNode('note') }}><StickyNote size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add text" aria-label="Add text" onClick={() => { setActiveTool('text'); addNode('text') }}><Type size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add code block" aria-label="Add code block" onClick={() => { setActiveTool('code'); addNode('code') }}><Code2 size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add rectangle" aria-label="Add rectangle" onClick={() => addNode('shape', 'rectangle')}><Square size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add circle" aria-label="Add circle" onClick={() => addNode('shape', 'circle')}><Circle size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add diamond" aria-label="Add diamond" onClick={() => addNode('shape', 'diamond')}><Diamond size={17} /></button>
            <button className="tool-button" disabled={!canInteract} title="Add checklist" aria-label="Add checklist" onClick={() => { setActiveTool('checklist'); addNode('checklist') }}><ListChecks size={17} /></button>
            <button className="template-tool-button" disabled={!canInteract} title="Browse templates" aria-label="Browse templates" onClick={() => setShowTemplateGallery(true)}><Copy size={15} /><span>Templates</span></button>
          </div>
          {['pen', 'brush', 'highlighter'].includes(activeTool) && canInteract && <div className="drawing-options" aria-label="Drawing options">
            <label>Color <input aria-label="Drawing color" type="color" value={drawingColor} onChange={(event) => setDrawingColor(event.target.value)} /></label>
            <label>Thickness <input aria-label="Drawing thickness" type="range" min="1" max="12" value={drawingWidth} onChange={(event) => setDrawingWidth(Number(event.target.value))} /><span>{drawingWidth}px</span></label>
          </div>}
          {selectedNode && canInteract && <div className="selection-toolbar" aria-label="Selected object formatting">
            <label title="Background color"><span>Fill</span><input aria-label="Fill color" type="color" value={selectedNode.data.backgroundColor ?? (selectedNode.type === 'note' ? '#fff1b9' : '#ffffff')} onChange={(event) => updateSelectedNode({ backgroundColor: event.target.value, tone: undefined })} /></label>
            <label title="Text color"><span>Text</span><input aria-label="Text color" type="color" value={selectedNode.data.textColor ?? '#343830'} onChange={(event) => updateSelectedNode({ textColor: event.target.value })} /></label>
            <label title="Font size"><span>Size</span><select aria-label="Font size" value={selectedNode.data.fontSize ?? (selectedNode.type === 'text' ? 15 : 12)} onChange={(event) => updateSelectedNode({ fontSize: Number(event.target.value) })}><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="20">20</option><option value="24">24</option><option value="32">32</option></select></label>
            <button type="button" className={selectedNode.data.bold ? 'format-button format-active' : 'format-button'} aria-label="Toggle bold" title="Bold" onClick={() => updateSelectedNode({ bold: !selectedNode.data.bold })}><Bold size={15} /></button>
            <button type="button" className={selectedNode.data.italic ? 'format-button format-active' : 'format-button'} aria-label="Toggle italic" title="Italic" onClick={() => updateSelectedNode({ italic: !selectedNode.data.italic })}><Italic size={15} /></button>
            {selectedNode.type === 'shape' && <label title="Shape type"><span>Shape</span><select aria-label="Shape type" value={selectedNode.data.shape ?? 'rectangle'} onChange={(event) => updateSelectedNode({ shape: event.target.value as 'rectangle' | 'circle' | 'diamond' })}><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="diamond">Diamond</option></select></label>}
            <button type="button" className="format-button" aria-label="Duplicate selected object" title="Duplicate" onClick={duplicateSelectedNode}><Copy size={15} /></button>
            <button type="button" className="format-button format-danger" aria-label="Delete selected object" title="Delete" onClick={deleteSelectedNode}><Trash2 size={15} /></button>
          </div>}

          <div className="canvas-live"><span className={`live-indicator ${collaborationStatus === 'offline' ? 'status-offline' : ''}`} /><span>{collaborationStatus === 'connected' ? `${Math.max(collaborators.length, 1)} here now` : collaborationStatus === 'offline' ? 'Reconnecting' : 'Connecting'}</span></div>
          <ReactFlow
            onInit={(instance) => { screenToFlowPositionRef.current = instance.screenToFlowPosition }}
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            minZoom={0.35}
            maxZoom={1.4}
            nodesDraggable={canInteract && !['pen', 'brush', 'highlighter', 'eraser'].includes(activeTool)}
            nodesConnectable={false}
            onNodeClick={(_event, node) => { if (activeTool === 'eraser' && canInteract && node.type === 'drawing') setNodes((current) => current.filter((item) => item.id !== node.id)) }}
            elementsSelectable
            deleteKeyCode={canInteract ? ['Backspace', 'Delete'] : null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d8d9d5" />
            <DrawingSurface activeTool={canInteract ? activeTool : 'select'} color={drawingColor} strokeWidth={drawingWidth} onFinish={finishDrawing} onEraseAt={(point) => setNodes((current) => current.filter((node) => { if (node.type !== 'drawing') return true; const width = node.data.width ?? 1; const height = node.data.height ?? 1; return point.x < node.position.x - 14 || point.x > node.position.x + width + 14 || point.y < node.position.y - 14 || point.y > node.position.y + height + 14 }))} />
            <Controls position="bottom-right" showInteractive={false} showFitView={false} />
            <CollaborationCursorLayer providerRef={providerRef} wrapperRef={canvasWrapperRef} cursors={remoteCursors} />
          </ReactFlow>
          <div className="canvas-hint"><MousePointer2 size={13} /> Drag anything to make room for a new idea</div>
        </div>

        
        {showCollaborationPanel && <CollaborationPanel board={board} canEdit={canEdit} selectedElement={selectedNode ? { id: selectedNode.id, title: selectedNode.data.title || selectedNode.id } : null} elements={nodes.map((node) => ({ id: node.id, title: node.data.title || node.id }))} onClose={() => setShowCollaborationPanel(false)} />}
        {showTemplateGallery && <TemplateGallery onChoose={applyTemplate} onClose={() => setShowTemplateGallery(false)} />}
      </section>
    </main>
  )
}

export default App
