# Makerspace signing desk

Separate Cloudflare Worker, private R2 image bucket, and D1 approval database. This service uses its own `workers.dev` address and does not route through or modify pitchinin.org. The website remains on GitHub Pages.

See [SETUP.md](SETUP.md) for the complete setup, publishing, and verification steps. From this directory, in your terminal:

```sh
npm install
npx wrangler login
npm run setup
```

The setup creates or reuses resources named `makerspace-signatures`, applies all four database migrations, prompts for the admin password, deploys the Worker, and fills in `signatureSettings.apiUrl` in `../dist/content.js`. Publish that changed file to GitHub Pages. If Cloudflare asks you to activate R2, do that in your dashboard before rerunning setup. Setup can be rerun; it reuses existing resources and prompts to update the password.

Enter **nick** at the secret prompt to use the owner’s selected battle password. Anyone who knows this shared password can manage signatures. Real approval access is still checked on the server; the preview’s browser comparison never grants access. Password changes take effect immediately for new logins. Existing sessions expire after four hours; to revoke all sessions immediately, run:

```sh
npx wrangler d1 execute makerspace-signatures --remote --command "DELETE FROM sessions"
```

Members use **Upload** on the last book spread to choose a PNG, JPG, or WebP and enter their name. The browser converts it to PNG, crops empty margins, and scales large images. The service independently decodes, validates, crops, and re-encodes PNGs, stripping metadata and rejecting blank, oversized, corrupt, and unsupported data. It accepts both transparent signatures and ordinary photos. After the server accepts the upload, the uploaded image appears on lined paper, visibly folds into a shaded 3D plane, and flies away. Reduced motion shows a short still confirmation. Skip, Escape, close, and resize are handled. Public upload copy says only “Send” and “Sent.” The help note credits ShaderLabs to Ewan McCorkell, Makerspace student.

Hover over or tap **Vol. 01**, then click the capture ball above Vol. 02. Clicking the capture ball first closes the open book before the battle animation begins, in both local preview and connected mode. Choose **FIGHT**, use **LASER CUTTER**, then enter **nick**. Victory returns to the signature spread; after the handheld leaves, signing controls appear alongside the book. A loss or escape returns to the original book location. An active session reopens the spread through the ball without another battle. The left sidebar includes **To review**, six preset designs, **Save**, **Reload**, and sign out. Click a review thumbnail to inspect the full image; drag it from the tray onto either sheet or use **Add to page** from its preview. Drag an image across the binding to move it between pages. Its corner handles resize it proportionally, and its × removes it from the draft. Arrow keys move focused images; arrow keys on a resize handle adjust the size. Delete removes the focused image. Touch users can inspect and add uploads, then drag and resize directly.

All changes stay in the admin’s tab until **Save** sends an authenticated `PUT /admin/layout` containing preset placements, uploaded image placements, and any removals. A D1 transaction publishes the entire arrangement together. Layout and image revisions reject stale saves before changing any image. `GET /layout` and `GET /signatures` load the saved collection for visitors. The server checks known preset keys, unique image IDs, and bounded coordinates. Migration `0003_collection_save.sql` adds the transaction marker; apply all migrations before deploying. Removing an upload from the collection returns it to review while retaining its private image. Reload and sign out discard drafts after confirmation. Public visitors refresh saved content every 30 seconds and when returning to the tab, while active admin drafts are preserved.

Without a configured service URL, Upload prepares the image but reports that sending is unavailable. No email fallback or success animation is shown. A successful **nick** battle unlocks a design preview; Save is disabled until the shared service is connected. It grants no server token or access to uploads. Cancelling a real battle discards its pending login, including responses arriving after cancellation. Connection errors and rate limits allow password retry without causing defeat.

`ALLOWED_ORIGINS` permits `https://pipelinear.github.io`. For local development add the preview origin in a local config or change this value deliberately; no wildcard origins or unrelated domains are needed. Admin bearer tokens stay in tab memory, private previews require authorization, and public image requests check approval each time. The Worker limits upload size and request frequency, stores hashed IP rate-limit keys, and clears expired sessions and counters daily.

Run `npm test` with Node 22.13+ (the tests use real SQLite and an in-memory R2 adapter). For a local Worker, create `.dev.vars` containing `ADMIN_PASSWORD=your-development-password`, apply migrations with `npx wrangler d1 migrations apply makerspace-signatures --local`, and use `npx wrangler dev`. Never commit `.dev.vars` or Cloudflare credentials.


## R2 usage limits

The service stores at most **1,000 images**, with new images automatically reduced to **512 KiB each** and a total storage cap of **512 MiB**. That is about 0.5 GB at the absolute maximum; 200 full-size prepared images use at most about 0.1 GB. Preset designs live in GitHub Pages assets and never use R2. Uploaded files explicitly use Standard storage, whose [current free allowance](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month, 1 million Class A operations, and 10 million Class B operations per month.

D1 atomically reserves capacity before R2 PUTs, including uploads running at the same time. It tracks uploads and image reads across a rolling **32 UTC-day window**, allowing at most **2,500 PUT attempts** and **100,000 GET attempts** in that window. Failed R2 attempts still count conservatively; restarting or redeploying does not reset usage. A failed upload retains its storage reservation if cleanup cannot confirm deletion. Limits pause the affected operation and preserve the collection. Standard R2 deletes are free, and storage capacity is released only after deletion succeeds.

Approved images are cached privately in the visitor’s browser for a day. Conditional requests and HEAD requests check current approval in D1 without touching R2. Private review previews stay uncached by HTTP and are reused as object URLs within the admin tab. No public R2 bucket URL is enabled by setup; keep the bucket private so requests go through these guards. This implementation does not depend on edge caching on the `workers.dev` URL.

Migration `0004_r2_budget.sql` adds the usage and storage tables. For an existing collection it estimates each older image at its previous 2 MiB maximum, so existing storage is counted conservatively. Apply the migration before deploying. `GET /admin/usage`, with the admin bearer token, reports the recorded storage, operation counts and configured caps using D1 only. You can lower the limits in `wrangler.jsonc`; values above the code’s maximum are rejected. Setting `R2_ENABLED` to `"false"` pauses R2 uploads and uncached image reads while still allowing cleanup.

These limits govern this Worker’s operations and the images tracked by its database. They cannot guarantee a zero Cloudflare bill: other buckets, applications, direct dashboard/CLI usage, untracked older objects, changing provider pricing, and other Cloudflare products are outside these counters. Do not configure an R2 lifecycle rule that moves these images to Infrequent Access, which has no free tier. Do not delete the usage tables or move this Worker to a fresh database while keeping its old bucket.
