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
  return (await request<UserResponse>('/auth/me')).user
}

export async function signIn(email: string, password: string): Promise<User> {
  return (await request<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })).user
}

export async function signUp(displayName: string, email: string, password: string): Promise<User> {
  return (await request<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName, email, password }),
  })).user
}

export async function signOut(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}

export async function getBoards(): Promise<Board[]> {
  return (await request<BoardsResponse>('/boards')).boards
}

export async function getCollaborationToken(): Promise<string> {
  return (await request<{ token: string }>('/auth/collaboration-token', { method: 'POST' })).token
}

export async function createBoard(title: string): Promise<Board> {
  return (await request<BoardResponse>('/boards', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })).board
}

export async function updateBoard(boardId: string, title: string): Promise<Board> {
  return (await request<BoardResponse>(`/boards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })).board
}

export async function deleteBoard(boardId: string): Promise<void> {
  await request<void>(`/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' })
}