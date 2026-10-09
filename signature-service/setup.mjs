// Run from a terminal after `npm install` and `npx wrangler login`.
// Creates only separate Makerspace resources, never a route on another domain.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'node_modules/wrangler/bin/wrangler.js');
function run(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: here, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
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
  const databases = parseOutput(run(['d1', 'list', '--json'], { capture: true }));
  let database = databases.find(item => item.name === 'makerspace-signatures');
  if (!database) {
    run(['d1', 'create', 'makerspace-signatures']);
    database = parseOutput(run(['d1', 'list', '--json'], { capture: true })).find(item => item.name === 'makerspace-signatures');
  }
  if (!database?.uuid) throw new Error('Could not find the Makerspace D1 database ID.');
  config.d1_databases[0].database_id = database.uuid;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  const buckets = run(['r2', 'bucket', 'list'], { capture: true });
  if (!/^name:\s*makerspace-signatures\s*$/m.test(buckets)) run(['r2', 'bucket', 'create', 'makerspace-signatures']);
  run(['d1', 'migrations', 'apply', 'makerspace-signatures', '--remote']);
  console.log('Choose a private admin password for the signing desk. It is stored as a Cloudflare secret.');
  run(['secret', 'put', 'ADMIN_PASSWORD']);
  const deployed = run(['deploy'], { capture: true });
  process.stdout.write(deployed);
  const url = deployed.match(/https:\/\/makerspace-signatures\.[a-z0-9-]+\.workers\.dev/); 
  if (!url) throw new Error('Worker deployed, but the URL could not be detected. Copy the workers.dev URL into signatureSettings.apiUrl in dist/content.js.');
  const contentPath = path.join(here, '../dist/content.js');
  const content = readFileSync(contentPath, 'utf8');
  if (!/apiUrl: '[^']*'/.test(content)) throw new Error('Could not find signatureSettings.apiUrl.');
  writeFileSync(contentPath, content.replace(/apiUrl: '[^']*'/, `apiUrl: '${url[0]}'`));
  console.log('Connected: ' + url[0]);
  console.log('Publish the updated dist/content.js to GitHub Pages to enable the upload and admin buttons.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
