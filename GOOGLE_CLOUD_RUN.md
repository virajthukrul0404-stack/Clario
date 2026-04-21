# Google Cloud Run Deployment

This project is best deployed to Google Cloud as two Cloud Run services:

- `clario-web`: the Next.js app
- `clario-socket`: the Socket.IO fallback server

## Why two services

The realtime server stores room and presence state in memory. That means it should stay on a single Cloud Run instance unless you replace it with Pusher or another shared realtime backend.

The included `deploy-gcp.ps1` script deploys:

1. The web app once to get its public URL.
2. The socket service with `NEXT_PUBLIC_APP_URL` and `NEXT_INTERNAL_TRPC_URL` pointed at that web URL.
3. The web app again with `NEXT_PUBLIC_SOCKET_URL` and `SOCKET_SERVER_INTERNAL_URL` pointed at the socket URL.

## Before you run it

- Install the Google Cloud CLI.
- Authenticate with `gcloud auth login`.
- Make sure your target project exists.
- Put production-safe environment values in an env file.

You can use `.env.local`, but a separate production file is safer:

```powershell
.\deploy-gcp.ps1 -ProjectId your-gcp-project-id -EnvFile .env.local
```

If you want to use a different region:

```powershell
.\deploy-gcp.ps1 -ProjectId your-gcp-project-id -Region asia-south1
```

## Realtime options

If you already configured Pusher, you can skip the socket service:

```powershell
.\deploy-gcp.ps1 -ProjectId your-gcp-project-id -EnvFile .env.local -SkipSocket
```

If you use the included socket server, keep these constraints in mind:

- The script deploys it with `--min-instances 1`.
- The script deploys it with `--max-instances 1`.
- The script sets a `3600` second request timeout so longer live sessions do not drop immediately.

## Environment variables

The script reads your env file and carries values into Cloud Run. It also sets these runtime values automatically:

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL=<web service URL>`
- `NEXT_PUBLIC_SOCKET_URL=<socket service URL>`
- `SOCKET_SERVER_INTERNAL_URL=<socket service URL>`
- `NEXT_INTERNAL_TRPC_URL=<web service URL>/api/trpc`

You still need your own production values for things like:

- `DATABASE_URL`
- `DIRECT_URL`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## After deployment

- Update the Clerk webhook endpoint to `https://<web-url>/api/webhooks/clerk`
- Verify sign-in works on the Cloud Run URL
- Verify a booking/session can open and that the second participant joins the same room
- If you later need horizontal realtime scaling, move to Pusher instead of the in-memory socket server
