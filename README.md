# CanvasLab

A collaborative whiteboard and shared code canvas built as a PERN portfolio project. The design focuses on real-time collaboration, conflict-safe editing, relational access control, and a clear, keyboard-friendly workspace.

## Current milestone

The frontend covers sign-in/sign-up, board listing/search, create/rename/delete, and the editable canvas. Vite development defaults to a browser-local demo so the UI works before PostgreSQL is available. Set `VITE_DEMO_MODE=false` in `client/.env.local` and restart Vite to use Express accounts/board metadata and Hocuspocus live document sync. The Express API issues signed collaboration tokens; Hocuspocus checks board membership, applies viewer read-only permissions, and persists Yjs snapshots. Demo invitations remain a local preview and do not send email. Real database-backed collaboration still needs a PostgreSQL smoke test.

The system requirements and architecture are documented in [RADIO.md](RADIO.md).

## Run the client

Requirements: Node.js 20.19+ or 22.12+. The local demo runs without PostgreSQL. API mode requires the API and PostgreSQL to be running.

```powershell
npm install --prefix client
npm run dev --prefix client
```

Open the local URL printed by Vite. To verify the current client build:

```powershell
npm run build --prefix client
```

In local demo mode, board content is stored in this browser's local storage. In API mode, board documents sync through the Hocuspocus WebSocket at `ws://localhost:1234` by default. Set `VITE_COLLAB_URL` for a deployed WebSocket endpoint.

## Run the API

To use real accounts and server-backed board metadata, set `VITE_DEMO_MODE=false` in `client/.env.local`, then restart the client after starting the API below.

Requirements: Node.js 20.19+ or 22.12+ and Docker Desktop for PostgreSQL.

```powershell
docker compose up -d db
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
npm run dev --prefix server
```

The API listens on `http://localhost:3001` and Hocuspocus on `ws://localhost:1234`; Vite proxies `/api` requests to the API. Check readiness with `Invoke-RestMethod http://localhost:3001/api/health`. The database credentials in Compose are for local development only.

Run backend checks with:

```powershell
npm run build --prefix server
npm test --prefix server
```

## Next milestones

1. Start PostgreSQL and exercise migrations, authentication, board APIs, and Yjs snapshot persistence end to end.
2. Verify two-browser simultaneous editing, reconnect recovery, and viewer enforcement against PostgreSQL.
3. Add real invitations, cursor visualization, deployment, and architecture documentation.
