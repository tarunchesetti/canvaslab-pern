# Email and board sharing setup

CanvasLab uses email/password registration and sign-in. Google single sign-on is not part of the authentication flow.

## Board invitations

Board owners can invite an email address with the **Editor** or **Viewer** role. The invitee must register or sign in with that same email address before accepting the expiring invitation link.

## Email delivery

For automatic board invitations and password-reset emails, configure a working provider on the Render API service. The current implementation supports either:

- **Gmail API:** `EMAIL_FROM`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and a valid `GMAIL_REFRESH_TOKEN` with the Gmail `gmail.send` scope.
- **Trusted webhook:** `PASSWORD_RESET_EMAIL_WEBHOOK_URL` and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET`, pointing to an email-delivery endpoint that accepts the documented transactional-email JSON body.

These Gmail OAuth credentials are used only by the server to send email; they do not enable Google sign-in. Keep secrets on the server and never put them in `VITE_*` variables or commit them to Git.

If an email provider is not configured or rejects the credentials, an invitation may still return a copyable invitation link with `emailSent: false`. A returned link alone does not confirm that an email was delivered.
