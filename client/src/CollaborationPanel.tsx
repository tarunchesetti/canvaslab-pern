import { useCallback, useEffect, useState } from 'react'
import { Activity, Bell, Check, History, ListChecks, MessageSquare, Plus, ThumbsUp, X } from 'lucide-react'
import type { Board } from './api'
import './CollaborationPanel.css'

type Tab = 'comments' | 'tasks' | 'vote' | 'activity' | 'history' | 'templates' | 'inbox'
type Item = Record<string, any>
type ElementSummary = { id: string; title: string }
const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBase + path, { ...init, credentials: 'include', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || 'Could not complete the request.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function CollaborationPanel({ board, canEdit, selectedElement, elements, onClose }: {
  board: Board; canEdit: boolean; selectedElement: ElementSummary | null; elements: ElementSummary[]; onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('comments')
  const [comments, setComments] = useState<Item[]>([])
  const [tasks, setTasks] = useState<Item[]>([])
  const [sessions, setSessions] = useState<Item[]>([])
  const [voteCounts, setVoteCounts] = useState<Item[]>([])
  const [activity, setActivity] = useState<Item[]>([])
  const [snapshots, setSnapshots] = useState<Item[]>([])
  const [templates, setTemplates] = useState<Item[]>([])
  const [notifications, setNotifications] = useState<Item[]>([])
  const [draft, setDraft] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [sessionTitle, setSessionTitle] = useState('Team vote')
  const [templateTitle, setTemplateTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [c, t, s, a, h, tm, n] = await Promise.all([
        api<{comments: Item[]}>('/boards/' + board.id + '/comments'),
        api<{tasks: Item[]}>('/boards/' + board.id + '/tasks'),
        api<{sessions: Item[]; voteCounts: Item[]}>('/boards/' + board.id + '/sessions'),
        api<{activity: Item[]}>('/boards/' + board.id + '/activity'),
        api<{snapshots: Item[]}>('/boards/' + board.id + '/snapshots'),
        api<{templates: Item[]}>('/templates'),
        api<{notifications: Item[]}>('/notifications'),
      ])
      setComments(c.comments); setTasks(t.tasks); setSessions(s.sessions); setVoteCounts(s.voteCounts)
      setActivity(a.activity); setSnapshots(h.snapshots); setTemplates(tm.templates); setNotifications(n.notifications); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load collaboration data.') }
  }, [board.id])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { const timer = window.setInterval(() => { void refresh() }, 15000); return () => window.clearInterval(timer) }, [refresh])
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'The action failed.') } finally { setBusy(false) }
  }
  const unreadCount = notifications.filter((item) => !item.read_at).length

  return (
    <div className="collab-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="collab-panel" role="dialog" aria-modal="true" aria-labelledby="collab-panel-title">
        <header className="collab-panel-header"><div><p className="auth-kicker">TEAM WORKSPACE</p><h2 id="collab-panel-title">Collaboration</h2><p className="collab-board-name">{board.title}</p></div><button className="dialog-close" onClick={onClose} aria-label="Close collaboration panel"><X size={18} /></button></header>
        <nav className="collab-tabs" aria-label="Collaboration tools">
          {([['comments', MessageSquare, 'Comments'], ['tasks', ListChecks, 'Tasks'], ['vote', ThumbsUp, 'Vote'], ['activity', Activity, 'Activity'], ['history', History, 'History'], ['templates', Plus, 'Templates'], ['inbox', Bell, unreadCount ? 'Inbox · ' + unreadCount : 'Inbox']] as const).map(([id, Icon, label]) => <button key={id} className={tab === id ? 'collab-tab active' : 'collab-tab'} onClick={() => setTab(id)}><Icon size={14} />{label}</button>)}
        </nav>
        <div className="collab-panel-content">
          {error && <div className="collab-error" role="alert">{error}</div>}
          {tab === 'comments' && <>
            <p className="collab-section-hint">{selectedElement ? 'Commenting on “' + selectedElement.title + '”.' : 'Add a board-wide comment or select an element to anchor the discussion.'}</p>
            <form className="collab-inline-form" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; void run(async () => { await api('/boards/' + board.id + '/comments', { method: 'POST', body: JSON.stringify({ body: draft.trim(), elementId: selectedElement?.id ?? null }) }); setDraft('') }) }}>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Share context or ask a question…" rows={3} maxLength={5000} /><button className="auth-submit" disabled={busy || !draft.trim()}>Add comment <Plus size={15} /></button>
            </form>
            <div className="collab-item-list">{comments.map((item) => <article className={item.resolved_at ? 'collab-item resolved' : 'collab-item'} key={item.id}><div className="collab-item-meta"><strong>{item.author_name || 'Teammate'}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><p>{item.body}</p>{item.element_id && <small>Attached to {elements.find((el) => el.id === item.element_id)?.title || 'a board element'}</small>}{canEdit && <button className="collab-text-action" onClick={() => void run(() => api('/boards/' + board.id + '/comments/' + item.id, { method: 'PATCH', body: JSON.stringify({ resolved: !item.resolved_at }) }))}>{item.resolved_at ? 'Reopen' : 'Resolve'}</button>}</article>)}{!comments.length && <p className="collab-empty">No comments yet. Start the discussion.</p>}</div>
          </>}
          {tab === 'tasks' && <>
            {canEdit && <form className="collab-inline-form compact" onSubmit={(event) => { event.preventDefault(); if (!taskTitle.trim()) return; void run(async () => { await api('/boards/' + board.id + '/tasks', { method: 'POST', body: JSON.stringify({ title: taskTitle.trim(), elementId: selectedElement?.id ?? null }) }); setTaskTitle('') }) }}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Add a follow-up task…" maxLength={240} /><button className="auth-submit" disabled={busy || !taskTitle.trim()}><Plus size={15} /> Add task</button></form>}
            <div className="collab-item-list">{tasks.map((task) => <article className="collab-item" key={task.id}><strong>{task.title}</strong><div className="collab-task-controls"><select aria-label={'Status for ' + task.title} disabled={!canEdit || busy} value={task.status} onChange={(event) => void run(() => api('/boards/' + board.id + '/tasks/' + task.id, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }))}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><span className={'task-priority priority-' + task.priority}>{task.priority}</span></div>{task.description && <p>{task.description}</p>}</article>)}{!tasks.length && <p className="collab-empty">Follow-up tasks appear here.</p>}</div>
          </>}
          {tab === 'vote' && <>
            {canEdit && <form className="collab-inline-form compact" onSubmit={(event) => { event.preventDefault(); void run(() => api('/boards/' + board.id + '/sessions', { method: 'POST', body: JSON.stringify({ type: 'voting', title: sessionTitle.trim() || 'Team vote', voteLimit: 3 }) })) }}><input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="Voting session name" maxLength={160} /><button className="auth-submit" disabled={busy}><Plus size={15} /> Start vote</button></form>}
            <p className="collab-section-hint">Each teammate gets up to three votes in an active session.</p>
            {sessions.map((session) => <article className="collab-item" key={session.id}><div className="collab-item-meta"><strong>{session.title}</strong><span>{session.status}</span></div>{session.type === 'voting' && session.status === 'active' && elements.map((element) => { const count = voteCounts.find((v) => v.session_id === session.id && v.element_id === element.id)?.vote_count ?? 0; return <div className="collab-vote-row" key={element.id}><span>{element.title} <small>· {count} votes</small></span><button className="collab-icon-action" disabled={busy} onClick={() => void run(() => api('/sessions/' + session.id + '/votes', { method: 'POST', body: JSON.stringify({ elementId: element.id }) }))} aria-label={'Vote for ' + element.title}><ThumbsUp size={15} /></button></div> })}{canEdit && session.status === 'active' && <button className="collab-text-action" onClick={() => void run(() => api('/sessions/' + session.id + '/close', { method: 'POST' }))}>Close session</button>}</article>)}
            {!sessions.length && <p className="collab-empty">Start a vote to prioritize ideas on this board.</p>}
          </>}
          {tab === 'activity' && <div className="collab-item-list">{activity.map((item) => <article className="collab-item" key={item.id}><div className="collab-item-meta"><strong>{item.actor_name || 'CanvasLab'}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><p>{item.event_type.replaceAll('.', ' ')}</p>{item.payload?.title && <small>{item.payload.title}</small>}</article>)}{!activity.length && <p className="collab-empty">Board activity will appear here.</p>}</div>}
          {tab === 'history' && <><button className="auth-submit collab-full-button" disabled={!canEdit || busy} onClick={() => void run(() => api('/boards/' + board.id + '/snapshots', { method: 'POST', body: JSON.stringify({ label: 'Snapshot · ' + new Date().toLocaleString() }) }))}><History size={15} /> Save current snapshot</button><p className="collab-section-hint">Snapshots preserve the latest saved document. Restore is held until active collaborators can safely reload.</p>{snapshots.map((snapshot) => <article className="collab-item" key={snapshot.id}><strong>{snapshot.label}</strong><p>Document version {snapshot.document_version}</p><small>{new Date(snapshot.created_at).toLocaleString()}</small></article>)}{!snapshots.length && <p className="collab-empty">Save a snapshot before a major workshop.</p>}</>}
          {tab === 'templates' && <><form className="collab-inline-form compact" onSubmit={(event) => { event.preventDefault(); if (!templateTitle.trim()) return; void run(async () => { await api('/templates', { method: 'POST', body: JSON.stringify({ title: templateTitle.trim(), description: 'Saved from ' + board.title, category: 'team', document: { boardId: board.id, elements } }) }); setTemplateTitle('') }) }}><input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Save board as a template" maxLength={120} /><button className="auth-submit" disabled={busy || !templateTitle.trim()}><Plus size={15} /> Save</button></form>{templates.map((template) => <article className="collab-item" key={template.id}><strong>{template.title}</strong><p>{template.description || template.category}</p><small>Template · {new Date(template.created_at).toLocaleDateString()}</small></article>)}{!templates.length && <p className="collab-empty">Save repeatable team workflows as templates.</p>}</>}
          {tab === 'inbox' && <div className="collab-item-list">{notifications.map((notification) => <article className={notification.read_at ? 'collab-item' : 'collab-item notification-unread'} key={notification.id}><div className="collab-item-meta"><strong>{notification.title}</strong>{!notification.read_at && <span>New</span>}</div><p>{notification.body}</p><small>{notification.board_title || 'CanvasLab'} · {new Date(notification.created_at).toLocaleString()}</small>{!notification.read_at && <button className="collab-text-action" onClick={() => void run(() => api('/notifications/' + notification.id + '/read', { method: 'PATCH' }))}><Check size={13} /> Mark read</button>}</article>)}{!notifications.length && <p className="collab-empty">You're all caught up.</p>}</div>}
        </div>
        <footer className="collab-panel-footer"><span><Activity size={13} /> Updates refresh every 15 seconds</span><button onClick={() => void refresh()}><Activity size={13} /> Refresh</button></footer>
      </section>
    </div>
  )
}
