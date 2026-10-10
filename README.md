# CanvasLab

A collaborative whiteboard and shared code canvas built as a PERN portfolio project. The design focuses on real-time collaboration, conflict-safe editing, relational access control, and a clear, keyboard-friendly workspace.

## Current milestone

The React client now uses the Express API for session restoration, registration/login, and board listing/creation. Board metadata and roles are stored in PostgreSQL. Canvas content is still a per-board browser draft; it is not yet saved to PostgreSQL or shared live. Invitations and Yjs collaboration are not implemented yet.

The system requirements and architecture are documented in [RADIO.md](RADIO.md).

## Run the client

Requirements: Node.js 20.19+ or 22.12+. Login and board management also require the API and PostgreSQL to be running.

```powershell
npm install --prefix client
npm run dev --prefix client
```

Open the local URL printed by Vite. To verify the current client build:

```powershell
npm run build --prefix client
```

Board content is currently stored in this browser's local storage. It is not shared between browsers or devices.

## Run the API

Requirements: Node.js 20.19+ or 22.12+ and Docker Desktop for PostgreSQL.

```powershell
docker compose up -d db
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
npm run dev --prefix server
```

The API listens on `http://localhost:3001`; Vite proxies `/api` requests to it. Check readiness with `Invoke-RestMethod http://localhost:3001/api/health`. The database credentials in Compose are for local development only.

Run backend checks with:

```powershell
npm run build --prefix server
npm test --prefix server
```

## Next milestones

1. Start PostgreSQL and exercise migrations, authentication, and board API flows end to end.
2. Persist canvas documents in PostgreSQL and add Yjs/Hocuspocus live collaboration with WebSocket role checks.
3. Verify simultaneous editing, reconnect recovery, and access enforcement against PostgreSQL.
4. Add invitations, deployment, and architecture documentation.
