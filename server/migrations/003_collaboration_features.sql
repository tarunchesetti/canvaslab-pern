CREATE TABLE board_comments (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  element_id VARCHAR(180),
  parent_comment_id UUID REFERENCES board_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (LENGTH(BTRIM(body)) BETWEEN 1 AND 5000),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX board_comments_board_created_idx ON board_comments (board_id, created_at DESC);
CREATE INDEX board_comments_parent_idx ON board_comments (parent_comment_id);
CREATE TABLE board_tasks (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  element_id VARCHAR(180),
  title VARCHAR(240) NOT NULL CHECK (LENGTH(BTRIM(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority VARCHAR(12) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX board_tasks_board_status_idx ON board_tasks (board_id, status, updated_at DESC);
CREATE INDEX board_tasks_assignee_idx ON board_tasks (assignee_id, status);
CREATE TABLE board_sessions (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  type VARCHAR(24) NOT NULL CHECK (type IN ('brainstorm', 'voting')),
  title VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  vote_limit INTEGER NOT NULL DEFAULT 3 CHECK (vote_limit BETWEEN 1 AND 20),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX board_sessions_board_created_idx ON board_sessions (board_id, created_at DESC);
CREATE TABLE session_votes (
  session_id UUID NOT NULL REFERENCES board_sessions(id) ON DELETE CASCADE,
  element_id VARCHAR(180) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, element_id, user_id)
);
CREATE INDEX session_votes_user_idx ON session_votes (session_id, user_id);
CREATE TABLE board_snapshots (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  document_snapshot BYTEA NOT NULL,
  document_version BIGINT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX board_snapshots_board_created_idx ON board_snapshots (board_id, created_at DESC);
CREATE TABLE board_activity (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX board_activity_board_created_idx ON board_activity (board_id, created_at DESC);
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  event_id UUID REFERENCES board_activity(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX user_notifications_user_unread_idx ON user_notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE TABLE board_templates (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX board_templates_owner_created_idx ON board_templates (owner_id, created_at DESC);
