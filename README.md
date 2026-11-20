# APECO ePTW standalone web application

This package adapts the published APECO ePTW trial, Version 17 (source commit
`568843a3b0f9768539d8d383eeb003a47ab1d0fa`). It uses the original APECO screens,
permit forms, attachments, role permissions and project-based workflow. The
outer ChatGPT sign-in has been removed. Staff log in directly to ePTW.

## Run a local management demo

Use Node.js 24 or later. Run the commands from this directory. The application
uses the Node runtime, SQLite and local attachment storage. It has no npm
dependencies.

1. Run `npm run build` to regenerate the embedded UI from `legacy/`.
2. Initialise the first Administrator. Set the username with the optional
   `APECO_ADMIN_USERNAME` environment variable before initialisation and keep
   the same value when starting the server. The default username is `admin`.
   The initialisation script reads a new password of 12–128 characters from
   standard input. Use an interactive prompt to keep it out of command history.

   PowerShell:

   ```powershell
   Read-Host -MaskInput "New Administrator password" | node scripts/init-admin.mjs
   ```

   Bash:

   ```bash
   read -rs -p 'New Administrator password: ' eptw_password
   printf '\n'
   printf '%s\n' "$eptw_password" | node scripts/init-admin.mjs
   unset eptw_password
   ```

3. Run `npm start` and open `http://localhost:3000`. Choose **Administrator
   Log In**. Use the Administrator portal to create demo users and provide
   their one-time setup codes through your normal internal channel. Staff
   choose **First login / Reset password** and set their own passwords.
4. Run `npm test` to verify the original workflow behaviour and the standalone
   server's login, account activation, project isolation, attachment storage,
   and permit processing.

## Host on an APECO-managed server

Run one application instance behind an HTTPS reverse proxy. Set `APECO_ORIGIN`
to the exact external origin, including any non-default port, before starting
the server. It is used for same-origin checks and setup links. The app listens
on `127.0.0.1:3000` by default. If the proxy runs on another host, use a private
interface via `HOST` and restrict access to the proxy. Use that proxy for HTTPS
termination and source-IP rate limiting.

Set `APECO_DATA_DIR` to a persistent application-only directory. Back up the
SQLite database and attachments together. A straightforward backup is to stop
the application and copy the entire data directory, then restart the service.
Keep the backend origin and storage directory out of public static hosting.

| Setting | Default or purpose |
| --- | --- |
| `PORT`, `HOST` | `3000`, `127.0.0.1` |
| `APECO_ORIGIN` | `http://localhost:3000` at the default port |
| `APECO_DATA_DIR` | `./data` relative to the working directory |
| `APECO_ADMIN_USERNAME` | `admin`; sets the protected owner Administrator login |
| `APECO_ADMIN_NAME` | Display name used by the initialisation script |
| `APECO_EMAIL_API_KEY`, `APECO_EMAIL_FROM` | Optional existing Resend setup email integration and verified sender |

This package starts with an empty database. The trial's users, credentials,
sessions, permits and documents are not in the package. Any data import and
MOM Annex B validation are separate from this source migration. The code
preserves the trial's existing permit behaviour for the management demo.
