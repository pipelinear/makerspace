// Run from a terminal after `npm install` and `npx wrangler login`.
// Creates only separate Makerspace resources, never a route on another domain.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'node_modules/wrangler/bin/wrangler.js');
function run(args, { capture = false, env = {} } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: here, encoding: 'utf8', env: { ...process.env, ...env }, stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
  if (result.error) throw new Error('Install the service dependencies first: npm install');
  if (result.status !== 0) throw new Error(`Cloudflare command failed: wrangler ${args.join(' ')}. Complete the step, then rerun npm run setup.`);
  return result.stdout || '';
}
function parseOutput(output) {
  const start = output.search(/[\[{]/);
  if (start < 0) throw new Error('Cloudflare did not return the expected resource list.');
  return JSON.parse(output.slice(start));
}
try {
  run(['whoami']);
  const configPath = path.join(here, 'wrangler.jsonc');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const binding = config.d1_databases.find(item => item.binding === 'DB');
  if (!binding) throw new Error('The Makerspace DB binding is missing from wrangler.jsonc.');
  const validID = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
  if (!validID(binding.database_id)) {
    const databases = parseOutput(run(['d1', 'list', '--json'], { capture: true }));
    const existing = databases.find(item => item.name === binding.database_name);
    if (existing) binding.database_id = existing.uuid;
    else {
      const created = run(['d1', 'create', binding.database_name, '--update-config=false', '--binding', 'DB'], { capture: true });
      process.stdout.write(created);
      binding.database_id = created.match(/"database_id"\s*:\s*"([a-f0-9-]{36})"/i)?.[1];
    }
    if (!validID(binding.database_id)) throw new Error('Copy the newly created database_id into the DB binding in wrangler.jsonc, then rerun npm run setup.');
    // Keep a successful creation even if a later API call or login fails.
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  }
  console.log('Using existing Makerspace database: ' + binding.database_id);
  const buckets = run(['r2', 'bucket', 'list'], { capture: true });
  if (!/^name:\s*makerspace-signatures\s*$/m.test(buckets)) run(['r2', 'bucket', 'create', 'makerspace-signatures']);
  run(['d1', 'migrations', 'apply', 'makerspace-signatures', '--remote']);
  console.log('Enter nick for ADMIN_PASSWORD to use the selected battle password. It is stored as a Cloudflare secret.');
  run(['secret', 'put', 'ADMIN_PASSWORD']);
  console.log('If asked to register a workers.dev subdomain, choose yes, enter pipelinear (or another available name), and confirm.');
  // Wrangler needs both stdin and stdout attached to Terminal to offer registration.
  // Read its structured deployment result instead of piping away interactive output.
  const outputDir = mkdtempSync(path.join(tmpdir(), 'makerspace-deploy-'));
  let serviceURL;
  try {
    const outputPath = path.join(outputDir, 'result.jsonl');
    run(['deploy'], { env: { WRANGLER_OUTPUT_FILE_PATH: outputPath } });
    let deployment;
    try {
      deployment = readFileSync(outputPath, 'utf8').trim().split('\n').map(line => JSON.parse(line)).findLast(item => item.type === 'deploy');
    } catch { /* A deployment without a result needs manual connection. */ }
    serviceURL = deployment?.targets?.find(target => typeof target === 'string' && /^https:\/\/makerspace-signatures\.[a-z0-9-]+\.workers\.dev$/.test(target));
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
  if (!serviceURL) throw new Error('Worker deployed, but the URL could not be detected. Copy the workers.dev URL into signatureSettings.apiUrl in dist/content.js.');
  const contentPath = path.join(here, '../dist/content.js');
  const content = readFileSync(contentPath, 'utf8');
  if (!/apiUrl: '[^']*'/.test(content)) throw new Error('Could not find signatureSettings.apiUrl.');
  writeFileSync(contentPath, content.replace(/apiUrl: '[^']*'/, `apiUrl: '${serviceURL}'`));
  console.log('Connected: ' + serviceURL);
  console.log('Publish the updated dist/content.js to GitHub Pages to enable the upload and admin buttons.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
