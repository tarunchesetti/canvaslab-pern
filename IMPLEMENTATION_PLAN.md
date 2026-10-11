# CanvasLab MVP completion plan

This branch tracks the remaining MVP work in priority order. Items are marked complete only after implementation and relevant checks.

## P0 — Authentication correctness
- [ ] Add Confirm Password to registration; block mismatches before calling the API.
- [ ] Add accessible inline validation and clear confirmation when switching auth modes.
- [ ] Implement password recovery with single-use, expiring tokens; hash tokens at rest; return generic responses to prevent account enumeration.
- [ ] Add a configured transactional email delivery path and document required secrets.
- [ ] Add tests for confirmation validation, reset-token expiry/reuse, and unknown-email behavior.

## P0 — Collaboration correctness
- [ ] Add two-client integration tests against a real Hocuspocus server and PostgreSQL.
- [ ] Verify reconnect recovery and document persistence after server restart.
- [ ] Verify viewer writes are rejected at the WebSocket layer, not only disabled in the UI.
- [ ] Verify membership revocation and board deletion invalidate access for active/new sessions.
- [ ] Test empty documents, large updates, concurrent moves and simultaneous text edits.

## P1 — Invitations
- [ ] Add expiring, single-use invitations tied to board, inviter, email and role.
- [ ] Send invitation email and accept invitations only for the invited email.
- [ ] Support listing/revoking pending invitations and handle existing members safely.
- [ ] Keep authorization checks server-side on every invitation endpoint.

## P1 — Canvas UX
- [ ] Render remote cursors from Yjs awareness using viewport/flow coordinates and collaborator colors.
- [ ] Persist code-block language as shared node data and expose a language selector.
- [ ] Add resize handles and persist node dimensions through Yjs; cover remote resize and reload.
- [ ] Add keyboard-accessible controls and read-only behavior for viewers.

## P1/P2 — Release readiness
- [ ] Run client build/lint/tests and server build/tests in CI.
- [ ] Run DB-backed smoke tests using a clean database.
- [ ] Validate production HTTPS/WSS, environment variables, rate limiting, document/update size limits, logs, backups and restore.
- [ ] Update README with completed features and exact local verification steps.

## Validation record
- Branch created from `main`: `feat/complete-canvaslab-mvp`
- Runtime tests have not yet been run by this branch automation.
