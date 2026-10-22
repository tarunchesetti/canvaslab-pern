'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Command, LoaderCircle, LogOut, Plus, Search } from 'lucide-react'
import { ApiError, createBoard, getBoards, getCurrentUser, signOut, type Board, type User } from '../../src/api'
import ThemeToggle from '../../src/ThemeToggle'
import '../../src/App.css'
import './boards.css'

export default function BoardsClient() {
  const [user, setUser] = useState<User | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const currentUser = await getCurrentUser()
        if (!active) return
        setUser(currentUser)
        setBoards(await getBoards())
      } catch (loadError) {
        if (!active) return
        if (loadError instanceof ApiError && loadError.status === 401) {
          window.location.replace('/login')
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Could not load your boards.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const filteredBoards = useMemo(() => boards.filter((board) =>
    board.title.toLowerCase().includes(query.trim().toLowerCase())), [boards, query])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const boardTitle = title.trim()
    if (!boardTitle || creating) return
    setCreating(true)
    setError('')
    try {
      const board = await createBoard(boardTitle)
      window.location.assign('/editor?board=' + encodeURIComponent(board.id))
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the board.')
      setCreating(false)
    }
  }

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      window.location.replace('/login')
    }
  }

  if (loading) return <main className="startup-screen"><span className="brand-mark"><Command size={17} /></span><LoaderCircle className="loading-icon" size={19} /><p>Loading your boards…</p></main>

  return (
    <main className="boards-page">
      <header className="boards-topbar">
        <Link className="brand" href="/" aria-label="CanvasLab home"><span className="brand-mark"><Command size={17} /></span><span>canvas<span className="brand-light">lab</span></span></Link>
        <div className="boards-account"><ThemeToggle />{user && <span className="boards-user">{user.displayName}</span>}<button className="button button-outline boards-signout" onClick={() => void handleLogout()}><LogOut size={15} /> Sign out</button></div>
      </header>
      <section className="boards-content">
        <div className="boards-heading">
          <div><p className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</p><h1>Your boards</h1><p className="boards-subtitle">Pick up where you left off, or start something new.</p></div>
          <button className="auth-submit boards-create" onClick={() => { setTitle(''); setShowCreate(true) }}><Plus size={17} /> New board</button>
        </div>
        <label className="boards-search"><Search size={17} /><input aria-label="Search boards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your boards…" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {filteredBoards.length > 0 ? <div className="boards-grid">{filteredBoards.map((board, index) => <button className="boards-card" key={board.id} onClick={() => window.location.assign('/editor?board=' + encodeURIComponent(board.id))}>
          <span className={'boards-card-art boards-card-art-' + (index % 4)} aria-hidden="true"><span /><span /><span /></span>
          <span className="boards-card-info"><strong>{board.title}</strong><small>{board.role === 'owner' ? 'Your board' : 'Shared with you'} · Updated {new Date(board.updated_at).toLocaleDateString()}</small></span><span className="boards-card-open" aria-label="Open board"><ArrowRight size={17} /></span>
        </button>)}</div> : <div className="boards-empty"><div className="boards-empty-mark"><Command size={22} /></div><h2>{query ? 'No matching boards' : 'Your next idea starts here'}</h2><p>{query ? 'Try another search term.' : 'Create your first board and bring your ideas together.'}</p>{!query && <button className="auth-submit" onClick={() => setShowCreate(true)}><Plus size={16} /> Create a board</button>}</div>}
      </section>
      {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setShowCreate(false) }}><section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="boards-create-title"><button className="dialog-close" aria-label="Close" disabled={creating} onClick={() => setShowCreate(false)}>×</button><p className="auth-kicker">NEW WORKSPACE</p><h2 id="boards-create-title">Create a board</h2><p className="auth-subtitle">Give your next idea a place to grow.</p><form onSubmit={(event) => void handleCreate(event)}><label className="auth-label" htmlFor="new-board-title">Board name</label><input id="new-board-title" className="auth-input" autoFocus maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Product brainstorm" required /><button className="auth-submit" disabled={creating || !title.trim()}>{creating ? 'Creating…' : 'Create board'} <ArrowRight size={16} /></button></form></section></div>}
    </main>
  )
}
