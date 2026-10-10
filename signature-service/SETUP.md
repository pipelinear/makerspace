# Connect the shared signing book

The website changes are ready locally. Shared uploads and Save need the Cloudflare service below. Setup has not been completed: the stored Cloudflare login has expired, and this coding environment cannot reach the authentication server. Run these commands in your Mac’s Terminal.

## 1. Sign in and run setup

After setup, double-click `makerspace/Local-Preview.command` to test the website locally with real uploads, admin login and shared saves. It opens `http://127.0.0.1:4173/` and connects to the already deployed service; leave its Terminal window open while testing. This needs no new Cloudflare deployment or password setup. Opening `dist/index.html` directly supports the animations, but browsers block shared-service login from `file://` pages. The preview routes only to the configured Makerspace service, binds to your computer's loopback address, and preserves the server's password and token checks.

Use the Cloudflare account that should own the Makerspace book. Enable R2 in its dashboard if Cloudflare asks.

```sh
cd /Users/nicholasgaston/Projects/Makerspace_Website/makerspace/signature-service
npm install
npx wrangler login
npm run setup
```

The browser opens for Cloudflare login. During setup, confirm the remote database migrations when prompted. At the `ADMIN_PASSWORD` prompt, enter **nick** to match the battle password. The password stays in Cloudflare as a secret.

Setup creates or reuses the Makerspace D1 database and private R2 bucket, applies **all four migrations**, deploys the Worker, and writes its URL into `dist/content.js`. The final output should say `Connected: https://makerspace-signatures.…workers.dev`. Rerunning setup preserves the collection and reuses its resources.

If R2 needs activation, open [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2), activate it, then rerun `npm run setup`. If Cloudflare reports `Authentication error [code: 10000]`, refresh the CLI login and retry:

```sh
npx wrangler logout
npx wrangler login
npm run setup
```

A database already recorded in `wrangler.jsonc` is reused directly; setup skips the database-list request and keeps the ID after successful creation, even if a later step fails. Do not paste your credentials into source files.

If you closed Terminal after signing in, double-click `Resume-Setup.command` in Finder to reopen it and run setup with the existing login. `Start-Setup.command` also opens Terminal, but refreshes the Cloudflare login first.

If your account has no `workers.dev` subdomain yet, setup offers registration directly in Terminal during deployment. Choose **yes**, enter **pipelinear** if available (or another name), and confirm. Leave Terminal open until setup prints `Connected:`. You do not need to connect GitHub or fill out Cloudflare's application build form for this step.

The service now includes image size, storage and request limits. It caps new photos at 512 KiB, the collection at 1,000 images, and stored data at 512 MiB. It pauses R2 writes after 2,500 attempts or uncached reads after 100,000 attempts across a rolling 32-day window. Keep the R2 bucket private and use Standard storage; the setup creates it without a public access URL. See [the usage limits](README.md#r2-usage-limits) for the scope and limitations of these protections.

## 2. Publish the website changes

From the repository folder, inspect the changes, then commit and push them when you’re ready:

```sh
cd /Users/nicholasgaston/Projects/Makerspace_Website/makerspace
git diff -- dist README.md
git status --short
git add dist signature-service README.md .gitignore
git commit -m "Update signing book, battle, and shared collection"
git push origin main
```

The existing **Publish Makerspace** GitHub Actions workflow publishes `dist` to GitHub Pages. Wait for it to finish in [Actions](https://github.com/pipelinear/makerspace/actions), then open [Makerspace](https://pipelinear.github.io/makerspace/). Publishing is necessary because setup changes the service URL locally.

## 3. Check the complete flow

1. Open the signature spread as a regular visitor. Upload an image and send it; your image should fold into the flying paper plane. The signing desk should be hidden.
2. Open the capture ball, choose **FIGHT → LASER CUTTER**, and enter **nick**. Win the battle; Pikachu turns with sparks and the signing desk appears to the left of the book. Losing or escaping must not unlock it.
3. In **To review**, click the submitted image to see it larger. Close the preview and drag the thumbnail onto either sheet, or use **Add to page** in the preview. Drag the image across sheets and use its corner handles to resize. Add preset designs if you want.
4. Click **Save**. Open the website in a private browser window and return to the signature spread. The saved images and designs should appear there too, with no signing desk. Unsaved drafts remain private to the admin’s current tab.

If the signing desk says the shared service is not connected, confirm `signatureSettings.apiUrl` in `dist/content.js` contains the deployed Worker URL and that the GitHub Pages workflow published that change. A stale-save message means another admin changed the collection: use **Reload** to load the latest saved book before arranging it again.

## Later service updates

Apply migrations before deploying an updated Worker:

```sh
cd /Users/nicholasgaston/Projects/Makerspace_Website/makerspace/signature-service
npx wrangler d1 migrations apply makerspace-signatures --remote
npm run deploy
```

The database and R2 bucket hold the growing shared collection. Keep those resources when updating the website. The upload service permits the existing GitHub Pages origin, `https://pipelinear.github.io`; a future custom domain needs to be added to `ALLOWED_ORIGINS` in `wrangler.jsonc` before redeploying.
