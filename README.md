# CanvasLab

A collaborative whiteboard and shared code canvas built as a PERN portfolio project. The design focuses on real-time collaboration, conflict-safe editing, relational access control, and a clear, keyboard-friendly workspace.

## Current milestone

The frontend uses Express for authentication and board metadata, and Hocuspocus/Yjs for live canvas synchronization. Boards and documents are stored in PostgreSQL. Board editing stays disabled until the shared document syncs. Invitations are not implemented yet.

The system requirements and architecture are documented in [RADIO.md](RADIO.md).

## Run the client

Requirements: Node.js 20.19+ or 22.12+ and the API/PostgreSQL started as described below. There is no demo account or local-data fallback.

```powershell
npm install --prefix client
npm run dev --prefix client
```

Open the local URL printed by Vite after the API is running in a second terminal. Without the API/database, sign-in shows a connection error and the board editor remains unavailable. To verify the current client build:

```powershell
npm run build --prefix client
```

Board documents sync through the Hocuspocus WebSocket at `ws://localhost:1234` by default. Set `VITE_COLLAB_URL` for a deployed WebSocket endpoint.

## Run the API

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
