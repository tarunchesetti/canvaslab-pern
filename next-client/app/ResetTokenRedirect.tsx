'use client'

import { useEffect } from 'react'

// Older reset emails may point to the site root with only the resetToken query.
// Normalize those links to the dedicated route before the landing page is used.
export default function ResetTokenRedirect() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken')
    if (!token) return

    const target = new URL('/reset-password', window.location.origin)
    target.searchParams.set('resetToken', token)
    window.location.replace(`${target.pathname}${target.search}`)
  }, [])

  return null
}
