# Google sign-in and board sharing setup

CanvasLab keeps email/password authentication and adds Google OpenID Connect sign-in. Existing board invitations continue to use the invitee's verified account email and the selected Editor or Viewer role.

## Google Cloud configuration

1. In Google Cloud Console, create or select a project and configure the OAuth consent screen.
2. Create an OAuth client ID of type **Web application**.
3. Add the exact callback URL to **Authorized redirect URIs**:
   - Local: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://YOUR-RENDER-API-HOST/api/auth/google/callback`
4. Set these variables on the Render **API service**:
   - `GOOGLE_CLIENT_ID`: OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: OAuth client secret
   - `GOOGLE_REDIRECT_URI`: exact callback URL configured above
   - `APP_BASE_URL`: frontend origin, for example `https://canvaslab-whiteboard.netlify.app`
   - `CLIENT_ORIGIN`: same frontend origin
5. For local development, add the local callback URL and set the same three Google variables in `server/.env`.

Keep the client secret only on the server. Do not add it to a `VITE_*` variable or commit it to Git. If the consent screen is in **Testing**, add the Google accounts you use to the test users list. For public use, complete Google's required consent-screen configuration and verification steps if applicable.

## Email invitations

Board invitation support already exists in the API. Board owners can invite an email address with the **Editor** or **Viewer** role. The invitee must sign in using the same email address before accepting the expiring invitation link.

For automatic delivery, configure a working provider on the Render API service. The current implementation supports either:
- Gmail API: `EMAIL_FROM`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and a valid `GMAIL_REFRESH_TOKEN` with the Gmail `gmail.send` scope.
- Trusted webhook: `PASSWORD_RESET_EMAIL_WEBHOOK_URL` and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET`, pointing to an email-delivery endpoint that accepts the documented transactional-email JSON body.

A successful OAuth login does not imply email delivery is configured. If provider credentials are invalid, the invitation endpoint may still return a usable invitation link with `emailSent: false`; fix the email provider before relying on automatic invitation delivery.

## Database migration and deployment

The new migration `003_google_oauth_accounts.sql` allows Google-only accounts to have no password hash. Run `npm run db:migrate` from the server package (or the configured Render migration step) against the production Neon database before deploying the new API version. Existing password-based accounts and their hashes are unchanged.

After setting Render environment variables, redeploy the API service. Netlify needs a frontend redeploy after the feature is merged.
