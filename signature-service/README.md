# Makerspace signing desk

Separate Cloudflare Worker, private R2 image bucket, and D1 approval database. This service uses its own `workers.dev` address and does not route through or modify pitchinin.org. The website remains on GitHub Pages.

From this directory, in your terminal:

```sh
npm install
npx wrangler login
npm run setup
```

The setup creates or reuses resources named `makerspace-signatures`, applies the database migration, prompts for the admin password, deploys the Worker, and fills in `signatureSettings.apiUrl` in `../dist/content.js`. Publish that changed file to GitHub Pages. If Cloudflare asks you to activate R2, do that in your dashboard before rerunning setup. Setup can be rerun; it reuses existing resources and prompts to update the password.

Enter **nick** at the secret prompt to use the owner’s selected battle password. Anyone who knows this shared password can manage signatures. Real approval access is still checked on the server; the preview’s browser comparison never grants access. Password changes take effect immediately for new logins. Existing sessions expire after four hours; to revoke all sessions immediately, run:

```sh
npx wrangler d1 execute makerspace-signatures --remote --command "DELETE FROM sessions"
```

Members hover over the small question mark on the last book spread for instructions, follow its TextStudio link, add their name, export a Transparent PNG, return, and use Upload to submit it with their name. The browser crops empty margins and scales large images. The service independently decodes, validates, crops, and re-encodes PNGs; it strips metadata and rejects opaque, blank, oversized, corrupt, and unsupported files. Uploaded images stay private until approved. The name and signature become public after approval.

Hover over or tap **Vol. 01**, then click the capture ball above Vol. 02. Choose **FIGHT**, use **LASER CUTTER**, then enter **nick** as the magic word to finish The Don battle. After the handheld shuts down and drops away, every completed battle returns to the signature spread; a successful server login also opens the review queue. An active session can reopen the desk directly through the ball. Approve or reject submissions, then choose **Arrange in book** to drag the signature, use arrow keys for small adjustments (Shift for larger steps), resize proportionally, move between pages, or auto-fit into an open slot. Both pages have twelve automatic slots, leaving the small help controls clear. Changes save directly to D1. Remove takes it off the public page and deletes its stored image. Concurrent edits return a conflict rather than silently overwrite another admin’s work. Visitors refresh the spread every 30 seconds and when returning to the tab.

Without a configured service URL, the help popover explicitly says shared uploads are not connected and provides the email fallback. **Upload** opens an image preparation dialog that validates/crops the PNG and offers a download to attach manually. The capture ball runs a labeled visual preview: nick wins, another password loses, and neither outcome creates an admin session. Cancelling a real battle discards its pending login, including responses arriving after cancellation. Connection errors and rate limits permit retrying the password instead of causing a defeat.

`ALLOWED_ORIGINS` permits `https://pipelinear.github.io`. For local development add the preview origin in a local config or change this value deliberately; no wildcard origins or unrelated domains are needed. Admin bearer tokens stay in tab memory, private previews require authorization, and public image requests check approval each time. The Worker limits upload size and request frequency, stores hashed IP rate-limit keys, and clears expired sessions and counters daily.

Run `npm test` with Node 22.13+ (the tests use real SQLite and an in-memory R2 adapter). For a local Worker, create `.dev.vars` containing `ADMIN_PASSWORD=your-development-password`, apply migrations with `npx wrangler d1 migrations apply makerspace-signatures --local`, and use `npx wrangler dev`. Never commit `.dev.vars` or Cloudflare credentials.
