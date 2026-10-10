# CanvasLab

A collaborative whiteboard and shared code canvas built as a PERN portfolio project. The design focuses on real-time collaboration, conflict-safe editing, relational access control, and a clear, keyboard-friendly workspace.

## Current milestone

The React board prototype supports draggable canvas objects, editable sticky notes and TypeScript blocks, local autosave, and responsive canvas controls. The Express API now has PostgreSQL migrations, cookie-session registration/login, and role-checked board metadata endpoints. The React client is not connected to those endpoints yet; canvas content is still local to the browser. Live Yjs collaboration and invitations are not implemented yet.

The architecture and implementation sequence are documented in [RADIO.md](RADIO.md).

## Run the client

Requirements: Node.js 20.19+ or 22.12+.

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

Requirements: Docker Desktop, Node.js 20.19+ or 22.12+.

```powershell
docker compose up -d db
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
npm run dev --prefix server
```

The API listens on `http://localhost:3001`. Check readiness with `Invoke-RestMethod http://localhost:3001/api/health`. The database credentials in Compose are for local development only.

Run backend checks with:

```powershell
npm run build --prefix server
npm test --prefix server
```

## Next milestones

1. Start PostgreSQL and run the initial migration.
2. Connect React authentication and board-list/create/update flows to the API.
3. Add Yjs/Hocuspocus collaboration with PostgreSQL-backed document persistence and WebSocket role checks.
4. Verify simultaneous editing, reconnect recovery, and access enforcement against PostgreSQL.
5. Add invitations, deployment, and architecture documentation.
