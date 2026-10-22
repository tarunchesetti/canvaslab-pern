'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { Command, LoaderCircle } from 'lucide-react'
import { ApiError, getCurrentUser, type User } from './api'
import AuthScreen from './AuthScreen'

const WorkspaceApp = lazy(() => import('./WorkspaceApp'))

function StartupScreen({ message }: { message: string }) {
  return <main className="startup-screen"><span className="brand-mark"><Command size={17} /></span><LoaderCircle className="loading-icon" size={19} /><p>{message}</p></main>
}

export default function App({ authMode }: { authMode?: 'login' | 'forgot' | 'reset' }) {
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

  const authPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const hasResetToken = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('resetToken')
  const routeAuthMode = hasResetToken ? 'reset' : authMode ?? (authPath === '/reset-password' ? 'reset' : authPath === '/forgot-password' ? 'forgot' : authPath === '/login' ? 'login' : null)

  function handleAuthenticated(authenticatedUser: User) {
    setUser(authenticatedUser)
    // /login intentionally renders the sign-in form even when a session exists.
    // Once sign-in succeeds, leave that explicit route so the workspace can render.
    if (authPath === '/login') {
      window.location.replace('/')
    }
  }

  if (routeAuthMode) {
    return <AuthScreen onAuthenticated={handleAuthenticated} initialError={authError} initialMode={routeAuthMode} />
  }
  if (authPending) return <StartupScreen message="Checking your session…" />
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} initialError={authError} />
  return <Suspense fallback={<StartupScreen message="Opening your workspace…" />}><WorkspaceApp user={user} onLogout={() => setUser(null)} /></Suspense>
}
