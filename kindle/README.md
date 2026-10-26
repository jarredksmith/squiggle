# Kindle apps

Pages built for the Kindle Scribe's web browser. Bookmark **https://jarredksmith.github.io/squiggle/kindle/** on the Kindle.

- **Squiggle**: `../kindle.html` (built from `src/kindle.template.html`, see the main README).
- **Chat**: `chat/kindle.html` on the Kindle, `chat/` on an iPhone. Same conversations, two looks: black-and-white e-ink on the Kindle, Messages-style on the iPhone.

These live in the Squiggle repo for now and can move to their own repo later. Nothing in `kindle/` triggers the iPhone or Android builds.

## Chat

Messages go through a small Cloudflare Worker (`worker/chat-worker.js`) with a D1 database, on Cloudflare's free tier.

- Every conversation has a long random code. The invite link and QR code carry it, and anyone with the code can read and post in that conversation, so share it only with the people in it.
- Only you can start conversations: the Kindle asks once for your passcode (`ADMIN_CODE`).
- The iPhone page checks for new messages every 3 seconds while it's open; the Kindle page every 15 seconds (and there's a Refresh button), since every redraw flashes the e-ink screen.
- Read receipts: "Read" shows under your last message once the other person's page has shown it.
- Not end-to-end encrypted: messages sit in your D1 database. Fine for chatting with friends, not for anything sensitive.

### Set up the helper (about 10 minutes, Cloudflare dashboard)

1. **Storage & Databases > D1 > Create database**, name it `kindle-chat`.
2. **Workers & Pages > Create > Create Worker**, name it `kindle-chat`, deploy the starter, then **Edit code**, replace everything with `worker/chat-worker.js`, and **Deploy**.
3. In the worker, **Settings > Bindings > Add > D1 database**: variable name `DB`, database `kindle-chat`.
4. **Settings > Variables and Secrets**:
   - `ADMIN_CODE` as a **Secret**: a passcode you make up
   - `ALLOWED_ORIGINS` as **Text**: `https://jarredksmith.github.io`
5. Copy the worker's address (`https://kindle-chat.YOUR-NAME.workers.dev`) and put it in `chat/config.js`, so no device has to paste it. Until then, each device asks for it once, and invite links carry it.

The tables create themselves on the first request.

### Use it

1. On the Kindle, open Chat, enter your name, tap **New**, name the conversation after your friend, and enter the passcode.
2. The Invite screen shows a QR code and a link. Your friend points their iPhone camera at the QR code (or opens the link), types their name, and they're in. On the iPhone, Share > Add to Home Screen makes it open like an app.
