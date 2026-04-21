## Socket server (optional fallback for calls + notifications)

Clario runs **two processes** locally:
- **Next.js app**: `http://localhost:3000`
- **Socket.io server**: `http://localhost:4000`

For hosted deployments, you can skip the separate Socket.io server if Pusher is configured:

- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `PUSHER_APP_ID`
- `PUSHER_SECRET`

### Start locally

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run socket
```

### Environment variables

Ensure these exist in `.env.local` (or `.env`):

- `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`
- `SOCKET_SERVER_INTERNAL_URL=http://localhost:4000`

If you are deploying without the socket fallback, set the Pusher variables above instead.

Optional TURN (recommended for real networks):
- `NEXT_PUBLIC_TURN_SERVER_URL`
- `NEXT_PUBLIC_TURN_SERVER_USERNAME`
- `NEXT_PUBLIC_TURN_SERVER_CREDENTIAL`

### Quick test (2 tabs)

1. Seed data: `npm run seed`
2. Open **two different browsers** (or a normal + incognito window).
3. Sign in as a learner in one, teacher in the other.
4. Open the same session room URL (from an upcoming booking) in both tabs:
   - `/session/<roomIdentifier>`
5. You should see:
   - Remote video fills the stage
   - Local video in PiP
   - Chat messages appear in real-time

If you see “Waiting…”, confirm the socket server is running on port 4000 and `NEXT_PUBLIC_SOCKET_URL` is correct.

