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

## Free email setup with Gmail API

CanvasLab can send board invitations and password-reset emails through the Gmail API without buying a domain. Standard Gmail API use has no additional API charge, but Gmail account sending limits still apply.

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the Gmail account you want CanvasLab to send from.
2. Create a project, enable **Gmail API**, and configure the OAuth consent screen. For a personal test, choose External and add your sender Gmail account as a test user.
3. Create an OAuth Client ID of type **Web application**. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI, then note the client ID and client secret.
4. Use Google's [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) with your own OAuth credentials. In its settings, enable **Use your own OAuth credentials**, enter the client ID and secret, and authorize the scope `https://www.googleapis.com/auth/gmail.send` for the sender Gmail account.
5. Exchange the authorization code for tokens and copy the **refresh token**. Keep the refresh token and client secret private. The redirect URI in the OAuth client must exactly match `https://developers.google.com/oauthplayground`.
6. In the Render `canvaslab-api` service, set `EMAIL_FROM` to that same Gmail address and configure `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`. Remove the old `SEND_API_KEY` and `RESEND_API_KEY` values to avoid confusion. Save and wait for Render to redeploy.
7. Send a test invitation to an inbox you can access and check Render logs and the sender Gmail's Sent folder.

**OAuth note:** If the consent screen remains in Testing, refresh tokens for Gmail scopes can expire after 7 days. This is suitable for an initial test but may require reauthorization. Publishing the OAuth app can involve Google verification requirements for the Gmail send scope. Do not publish or request broader scopes than necessary.

## Password recovery in local development

When `NODE_ENV=development` and no email provider is configured, password recovery returns a one-time reset URL in the UI so the complete flow can be tested locally without an email service. The link expires after 30 minutes and can only be used once.

## Sharing boards

Open a board and select **People** to invite a person by email and choose Editor or Viewer access. CanvasLab creates a unique invitation link that expires after 7 days. If Gmail API email delivery is configured, the server sends the invitation; otherwise, the UI shows a link you can copy and share manually. The recipient must register or sign in with the invited email address to accept it. Only board owners can invite people or change other members' roles.

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
- Keep Gmail OAuth client secrets and refresh tokens only in the Render `canvaslab-api` environment.
- Set `VITE_COLLAB_URL` to the deployed Hocuspocus WebSocket URL for the production frontend build.
- Deploy the Express API and Hocuspocus WebSocket service, and ensure board membership is enforced for every collaboration connection.
- Do not use the local Docker credentials in production.
