'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Command, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { completePasswordReset, requestPasswordReset, signIn, signUp, type User } from './api'
import { passwordsMatch } from './auth-validation'
import ThemeToggle from './ThemeToggle'
import './App.css'

export default function AuthScreen({ onAuthenticated, initialError, initialMode: forcedInitialMode }: { onAuthenticated: (user: User) => void; initialError: string; initialMode?: 'login' | 'forgot' | 'reset' }) {
  const currentPath = window.location.pathname
  const resolvedInitialMode: 'login' | 'register' | 'forgot' | 'reset' = forcedInitialMode ?? (currentPath === '/reset-password' ? 'reset' : currentPath === '/forgot-password' ? 'forgot' : 'login')
  const resetToken = resolvedInitialMode === 'reset' ? new URLSearchParams(window.location.search).get('resetToken') : null
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(resolvedInitialMode)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [error, setError] = useState(initialError || (resolvedInitialMode === 'reset' && !resetToken ? 'This password reset link is missing or invalid.' : ''))
  const [notice, setNotice] = useState(new URLSearchParams(window.location.search).get('passwordReset') === 'success' ? 'Password reset successfully. Please sign in with your new password.' : '')
  const [resetUrl, setResetUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Keep the forgot-password view in browser history so Back restores sign-in.
  useEffect(() => {
    function handleAuthPopState() {
      if (mode !== 'forgot') return
      setMode('login')
      setError('')
      setNotice('')
      setResetUrl('')
      setPassword('')
      setConfirmPassword('')
    }
    window.addEventListener('popstate', handleAuthPopState)
    return () => window.removeEventListener('popstate', handleAuthPopState)
  }, [mode])

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
        window.location.replace('/login?passwordReset=success')
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
      <ThemeToggle />
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
            {mode === 'login' && <button type="button" className="auth-link" onClick={() => { window.history.pushState({ canvasLabAuthMode: 'forgot' }, '', '/forgot-password'); setMode('forgot'); setError(''); setNotice(''); setResetUrl('') }}>Forgot password?</button>}
            {notice && <div className="auth-notice" role="status">{notice}{resetUrl && <p className="auth-reset-link"><a href={resetUrl}>Open local password reset link</a></p>}</div>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in to CanvasLab' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
              {submitting ? <LoaderCircle className="loading-icon" size={16} /> : <ArrowRight size={16} />}
            </button>
            {(mode === 'forgot' || mode === 'reset') && <button type="button" className="auth-link auth-back-link" onClick={() => { if (mode === 'forgot') { window.history.replaceState(null, '', '/login'); setMode('login'); setError(''); setNotice(''); setResetUrl(''); setPassword(''); setConfirmPassword(''); return } window.location.assign('/login') }}><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</button>}
          </form>
          <div className="auth-security">Your boards are private to your account.</div>
        </div>
        <div className="auth-panel-footer"><span>CANVASLAB 0.1</span><span>BUILT FOR BETTER BRAINSTORMS</span></div>
      </section>
    </main>
  )
}
