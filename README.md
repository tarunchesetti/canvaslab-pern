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

Requirements: Node.js 20.19+ or 22.12+ and either Docker Desktop or a hosted PostgreSQL database (for example Neon or Supabase). The migration runner uses the Node `pg` driver; `psql` is not required.

### Option A: Local PostgreSQL with Docker

```powershell
docker compose up -d db
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
```

### Option B: Hosted PostgreSQL

Create a PostgreSQL project with your provider, then copy its connection URL. In `server/.env`, set `DATABASE_URL` to that URL (including `sslmode=require` if the provider requires SSL) and replace `SESSION_SECRET` with a private random value of at least 32 characters. Do not commit `server/.env` or share the database URL.

```powershell
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
```

### Start the API

After either database option is ready, run:

```powershell
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


## Password recovery email delivery

Password recovery uses the new password reset token migration and a configurable email webhook. Configure `APP_BASE_URL` to the public client URL, `PASSWORD_RESET_EMAIL_WEBHOOK_URL` to a trusted server-side mail adapter, and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET` to its bearer-token secret. The adapter receives a JSON POST with `to`, `subject`, `text`, and `html`; it should return a 2xx status only after accepting the email. Keep the webhook URL and secret private. Without both webhook variables, the API returns a configuration error for password-reset requests. Reset tokens are stored hashed, expire after 30 minutes, are single-use, and completing a reset invalidates existing user sessions.
