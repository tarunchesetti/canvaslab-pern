# CanvasLab: Collaborative Whiteboard and Code Canvas

CanvasLab is a shared workspace where a small team can sketch ideas, annotate them, and edit code snippets together. The first release focuses on reliable collaboration and a polished end-to-end workflow, not on executing arbitrary code.

## R: Requirements

### MVP workflows

- A user can register, sign in, create a board, and invite collaborators by email.
- Board roles are `owner`, `editor`, and `viewer`; the server enforces permissions for both HTTP and WebSocket connections.
- Collaborators see board edits, participant presence, and cursors update live.
- The canvas supports sticky notes, text, and code blocks that can be moved and resized.
- Code blocks support simultaneous editing with syntax highlighting.
- Boards persist across reloads and reconnects; offline edits reconcile when the user reconnects.
- Users can search their boards, rename them, and remove collaborators.

### Quality and security requirements

- Concurrent edits converge without last-write-wins data loss.
- Persisted board content and board membership are protected by authorization checks.
- Presence and cursors are transient; board content is durable.
- Validate and limit incoming document updates, board size, and connection rates.
- The UI has explicit connecting, reconnecting, offline, empty, error, and permission-denied states.

### Deferred scope

Do not execute code in the API process. Code execution is a later milestone requiring an isolated, resource-limited sandbox with network and filesystem restrictions. Also defer voice/video, public boards, comments, and mobile-native clients.

## A: Architecture

Use a TypeScript PERN monorepo: React and Vite for the client, Node.js and Express for REST endpoints, and PostgreSQL for accounts, board metadata, membership, and durable document snapshots. Use React Flow (`@xyflow/react`) for the board surface, CodeMirror 6 for code blocks, and Yjs CRDT documents for concurrent shared state. Hocuspocus provides the Yjs WebSocket server and React-side provider.

```text
React client
  | HTTPS: auth, board metadata, membership
  +--------------------------> Express API
  |                             |
  | WSS: Yjs document updates   | SQL transactions
  +--------------------------> Hocuspocus service ----> PostgreSQL
                                (same Node deployment)
```

Express owns identity, board CRUD, invitations, and membership rules. The WebSocket authentication hook checks the same identity and board role before allowing a document connection. Editors can write; viewers are read-only. Never trust a client-supplied role. Keep the REST API and collaboration server in the same Node application initially so they can share authorization and persistence services.

Represent each board as a Yjs document. Store canvas elements in a shared Yjs map keyed by stable element ID; represent each code block's contents with a Y.Text so concurrent character edits merge correctly. Use Yjs awareness for transient presence and cursors; do not persist awareness state. Persist encoded document snapshots in PostgreSQL, debounced after updates and flushed on graceful shutdown. Add periodic snapshots or an update log only if measured document size or recovery time warrants it.

## D: Data Entities

- `users`: id, display name, unique email, password hash, created timestamp.
- `boards`: id, title, owner id, created/updated timestamps.
- `board_members`: board id, user id, role, invitation/acceptance timestamps; unique `(board_id, user_id)`.
- `board_documents`: board id, Yjs snapshot (`BYTEA`), document version, updated timestamp.

Use foreign keys and cascading cleanup deliberately. Index `board_members(user_id, board_id)` for a user's board list and `boards(owner_id, updated_at)` for owner views. Document contents are not duplicated into relational rows; board metadata and access rules remain queryable in PostgreSQL, while Yjs owns collaborative canvas state.

## I: Interface Design

The main screen is the working board, not a marketing page. Use a restrained light canvas with a compact top bar, a narrow left tool rail, a visible collaborator/presence area, and a contextual right panel. Keep the canvas itself spacious and let notes and code blocks provide the color.

- Board home: searchable list of boards, owner/member role, and last-updated time.
- Board top bar: editable title, save/connectivity state, collaborator avatars, and invite action.
- Canvas tools: select, sticky note, text, and code block; familiar icon buttons have tooltips.
- Canvas items: keyboard-accessible selection, move/resize handles, and visible authorship or collaborator cursors where useful.
- Code block: language selector, syntax-highlighted editor, and clear read-only behavior for viewers.
- Small screens: prioritize board navigation and code/content inspection; keep editing controls reachable without covering the work.

Design explicit states for initial load, no boards, no collaborators, reconnecting, lost connection, and access revoked. Avoid implying content is saved until the server has acknowledged persistence.

## O: Optimization and Deployment

Correctness comes first. Test that concurrent updates from two clients converge, viewer writes are rejected, reconnect restores edits, and persistence survives a server restart. Add indexes based on access patterns. Debounce snapshot writes, cap document and element sizes, and avoid broadcasting cursor updates as durable document transactions. Profile React Flow rendering with large boards before adding virtualization or more complex rendering.

Deploy the client and Node service over HTTPS/WSS with a managed PostgreSQL database. Confirm the host supports long-lived WebSocket connections. Configure allowed origins, secure cookies/tokens, secrets, database migrations, backups, and health checks. CI should run type checks, lint, API tests, and collaboration tests before deployment.

## Build Sequence

1. Confirm the MVP boundaries and the choice to defer code execution.
2. Scaffold the React client and Express/TypeScript API as npm workspaces.
3. Add PostgreSQL migrations for users, boards, memberships, and document snapshots.
4. Implement registration/login, board listing/creation, and role enforcement.
5. Add the Yjs/Hocuspocus connection and PostgreSQL snapshot persistence.
6. Build one vertical slice: create a board, add a sticky note, and see it update in a second browser session.
7. Add shared CodeMirror blocks, invitations, viewer mode, reconnect behavior, and tests.
8. Polish responsive/accessibility states, document architecture and tradeoffs, then deploy and publish.

## Interview Story

The central technical decision is using a CRDT for board content rather than writing a custom conflict-resolution protocol. Yjs merges concurrent changes; PostgreSQL stores durable snapshots; Express and the collaboration server enforce board membership; awareness carries ephemeral presence separately from saved content. A two-client concurrency test makes those choices demonstrable rather than theoretical.