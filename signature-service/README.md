# Makerspace signing desk

Separate Cloudflare Worker, private R2 image bucket, and D1 approval database. This service uses its own `workers.dev` address and does not route through or modify pitchinin.org. The website remains on GitHub Pages.

From this directory, in your terminal:

```sh
npm install
npx wrangler login
npm run setup
```

The setup creates or reuses resources named `makerspace-signatures`, applies the database migration, prompts for the admin password, deploys the Worker, and fills in `signatureSettings.apiUrl` in `../dist/content.js`. Publish that changed file to GitHub Pages. If Cloudflare asks you to activate R2, do that in your dashboard before rerunning setup. Setup can be rerun; it reuses existing resources and prompts to update the password.

Choose a **private admin password**. Volume 02’s `nick` password is visible in the public website source and provides no admin protection. The signing desk validates its separate password on the server; it is never included in the website files. Password changes take effect immediately for new logins. Existing sessions expire after four hours; to revoke all sessions immediately, run:

```sh
npx wrangler d1 execute makerspace-signatures --remote --command "DELETE FROM sessions"
```

Members use the link on the last book spread, add their name in TextStudio, export a Transparent PNG, return, and upload it with their name. The browser crops empty margins and scales large images. The service independently decodes, validates, crops, and re-encodes PNGs; it strips metadata and rejects opaque, blank, oversized, corrupt, and unsupported files. Uploaded images stay private until approved. The name and signature become public after approval.

On the same spread, **Admin sign in** opens the review queue. Approve or reject submissions, then choose **Arrange in book** to drag the signature, use arrow keys for small adjustments (Shift for larger steps), resize proportionally, move between pages, or auto-fit into an open slot. Changes save directly to D1. Remove takes it off the public page and deletes its stored image. Concurrent edits return a conflict rather than silently overwrite another admin’s work. Visitors refresh the spread every 30 seconds and when returning to the tab.

Without a configured service URL, the spread shows the email instructions and a small **Prepare image** button. It validates/crops the PNG and offers a download to attach manually; it never reports a shared submission or approval that has not happened.

`ALLOWED_ORIGINS` permits `https://pipelinear.github.io`. For local development add the preview origin in a local config or change this value deliberately; no wildcard origins or unrelated domains are needed. Admin bearer tokens stay in tab memory, private previews require authorization, and public image requests check approval each time. The Worker limits upload size and request frequency, stores hashed IP rate-limit keys, and clears expired sessions and counters daily.

Run `npm test` with Node 22.13+ (the tests use real SQLite and an in-memory R2 adapter). For a local Worker, create `.dev.vars` containing `ADMIN_PASSWORD=your-development-password`, apply migrations with `npx wrangler d1 migrations apply makerspace-signatures --local`, and use `npx wrangler dev`. Never commit `.dev.vars` or Cloudflare credentials.
