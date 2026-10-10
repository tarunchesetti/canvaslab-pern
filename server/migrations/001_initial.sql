CREATE TABLE users (
  id UUID PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email));

CREATE TABLE boards (
  id UUID PRIMARY KEY,
  title VARCHAR(120) NOT NULL CHECK (LENGTH(BTRIM(title)) > 0),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX boards_owner_updated_idx ON boards (owner_id, updated_at DESC);

CREATE TABLE board_members (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE INDEX board_members_user_board_idx ON board_members (user_id, board_id);

CREATE TABLE board_documents (
  board_id UUID PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL DEFAULT decode('0000', 'hex'),
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
