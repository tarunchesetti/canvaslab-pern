# CanvasLab Collaboration Product Roadmap

## Product direction
CanvasLab helps remote teams turn shared ideas into decisions and decisions into action, preserving context on the board. Prioritize asynchronous collaboration rather than duplicating a general document editor.

## Delivery phases
- **Phase 0 — Reliability (weeks 1–2):** sync recovery, permission checks, reconnect tests, mobile polish, database indexes and structured errors.
- **Phase 1 — Async collaboration (weeks 3–5):** element-anchored comments and replies, activity feed, in-app notifications, decision records.
- **Phase 2 — Idea to Action (weeks 6–9):** brainstorming/voting sessions, tasks linked to board elements, assignees and due dates, facilitator controls.
- **Phase 3 — Trust and reuse (weeks 10–12):** named snapshots, restore with collaboration-aware document reload, reusable templates, export improvements.
- **Phase 4 — Differentiation:** opt-in AI summaries/task extraction, presenter follow mode, text-to-diagram, based on observed user demand.

Estimates assume a small development effort and usable existing board/auth/share flows. They are planning ranges, not delivery guarantees.

## First implementation slice
Migration `003_collaboration_features.sql` introduces comments/replies, tasks, sessions/votes, snapshots, activity, notifications, user-owned templates, and decision records. `server/src/routes/collaboration.ts` exposes authenticated endpoints for these records. Board endpoints check membership; mutating endpoints check editor access where appropriate.

## API surface
- `GET/POST /api/boards/:boardId/comments`
- `PATCH /api/boards/:boardId/comments/:commentId` (resolve/unresolve)
- `GET/POST /api/boards/:boardId/tasks`
- `PATCH /api/boards/:boardId/tasks/:taskId`
- `GET/POST /api/boards/:boardId/decisions`, `PATCH /api/boards/:boardId/decisions/:decisionId`
- `GET/POST /api/boards/:boardId/sessions`
- `POST /api/sessions/:sessionId/votes`
- `POST /api/sessions/:sessionId/close`
- `GET /api/boards/:boardId/activity`
- `GET /api/notifications`, `PATCH /api/notifications/:notificationId/read`
- `GET/POST /api/boards/:boardId/snapshots`
- `GET/POST /api/templates`

## Free hosting and Neon constraints
- Keep Netlify + current Render API/collaboration services + Neon Postgres.
- No Redis, second database, or paid analytics for the MVP.
- Use durable database state, bounded pagination and retention, connection pooling, and migration-based changes.
- Snapshot creation keeps the latest 50 per board.
- AI must be opt-in, scoped to selected content, provider-configured, and usage-limited.

## Not yet complete
The new APIs and collaboration drawer cover comments, tasks, voting, decision records, activity, snapshots, templates, and notifications. A local distraction-free presentation mode is also included. This is a foundation, not a claim that every roadmap item is finished. Frontend workflows, template-to-board creation, decision records, snapshot restore, AI, presentation follow mode, richer export, automated integration tests, and deployed verification remain follow-up work. Snapshot restore is intentionally withheld until active Hocuspocus documents can be safely reloaded or collaborators coordinated.

## Acceptance gates
1. Concurrent edits preserve each other's changes.
2. Reconnect recovers the latest persisted board state.
3. Viewers cannot mutate board or collaboration resources.
4. Comments/tasks/sessions/notifications persist and remain scoped to board membership.
5. Vote limits and duplicate-vote prevention are enforced server-side.
6. Snapshot restore cannot silently overwrite active collaborators.
7. Production readiness requires API/client build, migration, authorization and end-to-end tests.
