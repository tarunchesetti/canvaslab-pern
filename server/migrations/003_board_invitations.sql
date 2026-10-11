CREATE TABLE board_invitations (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX board_invitations_board_created_idx
  ON board_invitations (board_id, created_at DESC);

CREATE INDEX board_invitations_expiry_idx
  ON board_invitations (expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
