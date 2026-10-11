# CanvasLab MVP completion plan

This branch contains a prioritized MVP implementation. The checklist distinguishes code added from environment-backed verification still required.

## P0 — Authentication correctness
- [x] Add Confirm Password to registration and block mismatches before calling the API.
- [x] Add inline mismatch feedback and clear auth form state when switching modes.
- [x] Add password recovery request/completion endpoints with hashed, single-use tokens and 30-minute expiry.
- [x] Add reset screens and a configurable server-side email webhook contract.
- [x] Add unit tests for password confirmation and reset payload validation.
- [ ] Add integration tests for token expiry/reuse and unknown-email behavior against PostgreSQL and email adapter.

## P0 — Collaboration correctness
- [x] Add Yjs two-client update exchange, convergence, snapshot reconnect, and shared node metadata tests.
- [ ] Add tests against a real Hocuspocus server and PostgreSQL.
- [ ] Verify persisted documents survive server restart in a clean database.
- [ ] Verify viewer writes are rejected at the WebSocket layer, membership revocation, and board deletion invalidate active/new sessions.
- [ ] Add coverage for large updates and simultaneous moves/text edits.

## P1 — Invitations
- [x] Add expiring invitation records tied to board, email, role, inviter, and a hashed token.
- [x] Add owner-only invite creation and email delivery via the configured webhook.
- [x] Add signed-in acceptance restricted to the invited email and client URL token flow.
- [x] Reject invitations for existing board members.
- [ ] Add listing/revoking pending invitations and integration tests for expiry/reuse/authorization.

## P1 — Canvas UX
- [x] Publish local pointer coordinates through Hocuspocus awareness and render remote cursors.
- [x] Persist code-block language and expose JavaScript/TypeScript selection.
- [x] Add resize handles and persist dimensions through Yjs.
- [ ] Add browser-level tests for cursor positioning, remote resize/reload, and viewer interaction.

## P1/P2 — Release readiness
- [x] Add CI workflow for client build, lint, tests, and server build/tests.
- [ ] Confirm CI workflow is green.
- [ ] Run DB-backed smoke tests using a clean database.
- [ ] Validate production HTTPS/WSS, email delivery, rate limiting, update size limits, logs, backups, and restore.
- [x] Document configuration and limitations in README and this file.

## Validation record
- Branch: `feat/complete-canvaslab-mvp`, based on `main`; changes are not merged.
- GitHub API edits and commits completed. No local checkout was available to execute npm commands directly.
- Collaboration tests use actual Yjs documents and update/snapshot exchange, but do not launch Hocuspocus or PostgreSQL.
- Password recovery and invitation email delivery require `APP_BASE_URL`, `PASSWORD_RESET_EMAIL_WEBHOOK_URL`, and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET`. The configured webhook must accept authenticated JSON POSTs containing `to`, `subject`, `text`, and `html`.
- Run `npm run db:migrate --prefix server` before deploying the updated server. Runtime and production behavior remain unverified until CI and environment-backed smoke tests pass.
