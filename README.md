# CanvasLab

CanvasLab is a collaborative whiteboard and shared code canvas built with React, TypeScript, Vite, Express, PostgreSQL, Hocuspocus, and Yjs.

## Features

- Email/password registration and sign-in, confirm-password validation, session logout, and password reset.
- Private boards with create, rename, delete, board switching, search, and board-link copying.
- Shared board invitations with editor/viewer roles, expiring invite links, member listing, role changes, and member removal.
- Live collaborative notes, text blocks, and code blocks backed by Yjs/Hocuspocus.
- Remote collaborator cursors, live presence, sync status, and reconnect-aware document loading.
- Resizable note/text/code blocks, JavaScript and TypeScript code-language selection, canvas zoom/pan, and canvas search.
- Server-side board membership and role checks; invitation tokens and password-reset tokens are stored as hashes and expire.

## Requirements

- Node.js 20.19+ or 22.12+
- Docker Desktop (for the local PostgreSQL option)
- npm

## Run locally on Windows

Run commands from the repository root in PowerShell or the VS Code terminal.

### 1. Start PostgreSQL

```powershell
docker compose up -d db
```

The local database uses development-only credentials declared in `docker-compose.yml`. Do not reuse these credentials in production.

### 2. Configure and migrate the API database

```powershell
Copy-Item server/.env.example server/.env
npm install --prefix server
npm run db:migrate --prefix server
```

The checked-in example points at the local Docker database. Keep `NODE_ENV=development` for local development and change `SESSION_SECRET` to a random string of at least 32 characters. Do not commit `server/.env`.

### 3. Start the API and collaboration server

In terminal 1:

```powershell
npm run dev --prefix server
```

The API listens on `http://localhost:3001`; Hocuspocus listens on `ws://localhost:1234`. Verify the API and database with:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

### 4. Start the frontend

In terminal 2:

```powershell
npm install --prefix client
npm run dev --prefix client
```

Open the URL Vite prints (normally [http://localhost:5173](http://localhost:5173)). The Vite dev server proxies `/api` requests to the local API.

## Password recovery in local development

When `NODE_ENV=development` and no email webhook is configured, password recovery returns a one-time reset URL in the UI so the complete flow can be tested locally without an email service. The link expires after 30 minutes and can only be used once. This development-only link response must not be enabled in production.

For production email delivery, configure `APP_BASE_URL`, `PASSWORD_RESET_EMAIL_WEBHOOK_URL`, and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET` in the server environment. The trusted webhook receives an authenticated JSON POST with `to`, `subject`, `text`, and `html` fields and should return a 2xx response only after accepting the email.

## Sharing boards

Open a board and select **People** to invite a person by email and choose Editor or Viewer access. CanvasLab creates a unique invitation link that expires after 7 days. If email delivery is configured, the server sends the invitation; otherwise, the UI shows a link you can copy and share manually. The recipient must register or sign in with the invited email address to accept it. Only board owners can invite people or change other members' roles.

The **Share** button copies the current board URL; it does not grant access by itself. Use **People** to issue an invitation and grant membership.

## Tests and build checks

```powershell
npm run build --prefix client
npm test --prefix client
npm run build --prefix server
npm test --prefix server
```

For an end-to-end smoke test, create two accounts, invite the second account as an editor, open the invitation in a separate browser session, and verify that changes to notes/text/code blocks appear in both sessions. Also verify viewer access is read-only, password reset succeeds, and a used or expired token is rejected.

## Production notes

- Use a managed PostgreSQL database and run `npm run db:migrate --prefix server`.
- Set a strong private `SESSION_SECRET`, `NODE_ENV=production`, `CLIENT_ORIGIN`, and `APP_BASE_URL`.
- Configure the password-reset/invitation email webhook for real email delivery.
- Set `VITE_COLLAB_URL` to the deployed Hocuspocus WebSocket URL for the production frontend build.
- Deploy the Express API and Hocuspocus WebSocket service, and ensure board membership is enforced for every collaboration connection.
- Do not use the local Docker credentials in production.
