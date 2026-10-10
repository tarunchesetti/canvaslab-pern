export interface User {
  id: string
  displayName: string
  email: string
}

export interface Board {
  id: string
  title: string
  role: 'owner' | 'editor' | 'viewer'
  created_at: string
  updated_at: string
}

export const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false'

const demoSessionKey = 'canvaslab:demo:session'

function demoBoardsKey(userId: string) {
  return `canvaslab:demo:boards:${userId}`
}

function getDemoUser(): User {
  const storedUser = localStorage.getItem(demoSessionKey)
  if (!storedUser) throw new ApiError('Sign in to continue.', 401)

  try {
    return JSON.parse(storedUser) as User
  } catch {
    localStorage.removeItem(demoSessionKey)
    throw new ApiError('Sign in to continue.', 401)
  }
}

function storeDemoUser(displayName: string, email: string): User {
  const normalizedEmail = email.trim().toLowerCase()
  const profileKey = `canvaslab:demo:profile:${normalizedEmail}`
  const storedProfile = localStorage.getItem(profileKey)
  const user: User = storedProfile
    ? JSON.parse(storedProfile) as User
    : { id: `demo-${crypto.randomUUID()}`, displayName: displayName.trim(), email: normalizedEmail }

  if (displayName.trim()) user.displayName = displayName.trim()
  localStorage.setItem(profileKey, JSON.stringify(user))
  localStorage.setItem(demoSessionKey, JSON.stringify(user))
  return user
}

function getDemoBoards(userId: string): Board[] {
  const key = demoBoardsKey(userId)
  const storedBoards = localStorage.getItem(key)
  if (storedBoards) {
    try {
      return JSON.parse(storedBoards) as Board[]
    } catch {
      localStorage.removeItem(key)
    }
  }

  const timestamp = new Date().toISOString()
  const starterBoard: Board = {
    id: `demo-board-${crypto.randomUUID()}`,
    title: 'Product jam',
    role: 'owner',
    created_at: timestamp,
    updated_at: timestamp,
  }
  localStorage.setItem(key, JSON.stringify([starterBoard]))
  return [starterBoard]
}

interface UserResponse {
  user: User
}

interface BoardsResponse {
  boards: Board[]
}

interface BoardResponse {
  board: Board
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Can’t reach CanvasLab API. Start the server and database, then try again.', 0)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    const unavailableMessage = response.status >= 500
      ? 'CanvasLab API is unavailable. Start the API and database, then try again.'
      : 'The request could not be completed.'
    throw new ApiError(payload?.error ?? unavailableMessage, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function getCurrentUser(): Promise<User> {
  if (demoMode) return getDemoUser()
  return (await request<UserResponse>('/auth/me')).user
}

export async function signIn(email: string, password: string): Promise<User> {
  if (demoMode) {
    if (!email.trim() || !password) throw new ApiError('Enter an email and password.', 400)
    const profileKey = `canvaslab:demo:profile:${email.trim().toLowerCase()}`
    const storedProfile = localStorage.getItem(profileKey)
    const user = storedProfile
      ? JSON.parse(storedProfile) as User
      : storeDemoUser(email.trim().split('@')[0] || 'CanvasLab user', email)
    localStorage.setItem(demoSessionKey, JSON.stringify(user))
    return user
  }
  return (await request<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })).user
}

export async function signUp(displayName: string, email: string, password: string): Promise<User> {
  if (demoMode) {
    if (password.length < 12) throw new ApiError('Use a password with at least 12 characters.', 400)
    return storeDemoUser(displayName, email)
  }
  return (await request<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName, email, password }),
  })).user
}

export async function signOut(): Promise<void> {
  if (demoMode) {
    localStorage.removeItem(demoSessionKey)
    return
  }
  await request<void>('/auth/logout', { method: 'POST' })
}

export async function getBoards(): Promise<Board[]> {
  if (demoMode) return getDemoBoards(getDemoUser().id)
  return (await request<BoardsResponse>('/boards')).boards
}

export async function createBoard(title: string): Promise<Board> {
  if (demoMode) {
    const user = getDemoUser()
    const board: Board = {
      id: `demo-board-${crypto.randomUUID()}`,
      title: title.trim(),
      role: 'owner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const boards = getDemoBoards(user.id)
    localStorage.setItem(demoBoardsKey(user.id), JSON.stringify([board, ...boards]))
    return board
  }
  return (await request<BoardResponse>('/boards', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })).board
}

export async function updateBoard(boardId: string, title: string): Promise<Board> {
  if (demoMode) {
    const user = getDemoUser()
    const boards = getDemoBoards(user.id)
    const board = boards.find((item) => item.id === boardId)
    if (!board) throw new ApiError('Board not found.', 404)
    const updatedBoard = { ...board, title: title.trim(), updated_at: new Date().toISOString() }
    localStorage.setItem(demoBoardsKey(user.id), JSON.stringify(boards.map((item) => item.id === boardId ? updatedBoard : item)))
    return updatedBoard
  }
  return (await request<BoardResponse>(`/boards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })).board
}

export async function deleteBoard(boardId: string): Promise<void> {
  if (demoMode) {
    const user = getDemoUser()
    const boards = getDemoBoards(user.id).filter((item) => item.id !== boardId)
    localStorage.setItem(demoBoardsKey(user.id), JSON.stringify(boards))
    localStorage.removeItem(`canvaslab:board:${boardId}`)
    return
  }
  await request<void>(`/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' })
}