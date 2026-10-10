import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const uuid = '93d83ad6-6ef0-46d6-addc-0d20e2b38e8f';
function fixture(databaseID, failMigrations) {
  const root = mkdtempSync(path.join(tmpdir(), 'makerspace-setup-test-'));
  const service = path.join(root, 'signature-service');
  mkdirSync(path.join(service, 'node_modules/wrangler/bin'), { recursive: true });
  mkdirSync(path.join(root, 'dist'));
  const config = { d1_databases: [{ binding: 'DB', database_name: 'makerspace-signatures', database_id: databaseID }] };
  writeFileSync(path.join(service, 'package.json'), '{"type":"module"}');
  writeFileSync(path.join(service, 'setup.mjs'), readFileSync(new URL('../setup.mjs', import.meta.url)));
  writeFileSync(path.join(service, 'wrangler.jsonc'), JSON.stringify(config));
  writeFileSync(path.join(service, 'control.json'), JSON.stringify({ failMigrations }));
  // Check the real child-process options: capturing stdout disables Wrangler prompts.
  writeFileSync(path.join(service, 'check-terminal.mjs'), `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import assert from 'node:assert/strict';
    const original = childProcess.spawnSync;
    childProcess.spawnSync = (command, args, options) => {
      if (args[1] === 'deploy') assert.equal(options.stdio, 'inherit', 'Deployment must retain Terminal stdin and stdout');
      return original(command, args, options);
    };
    syncBuiltinESMExports();
  `);
  writeFileSync(path.join(root, 'dist/content.js'), "window.MAKERSPACE = { signatureSettings: { apiUrl: '' } };\n");
  writeFileSync(path.join(service, 'node_modules/wrangler/bin/wrangler.js'), `
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
    if (args[0] === 'whoami') console.log('Signed in');
    else if (args[0] === 'd1' && args[1] === 'list') console.log('[]');
    else if (args[0] === 'd1' && args[1] === 'create') console.log(JSON.stringify({ database_id: '${uuid}' }));
    else if (args[0] === 'r2' && args[2] === 'list') console.log('name: makerspace-signatures');
    else if (args[0] === 'd1' && args[1] === 'migrations') {
      if (JSON.parse(fs.readFileSync('control.json')).failMigrations) process.exit(1);
    }
    else if (args[0] === 'secret') console.log('Secret stored');
    else if (args[0] === 'deploy') {
      const control = JSON.parse(fs.readFileSync('control.json'));
      fs.writeFileSync('deployment-output-path.txt', process.env.WRANGLER_OUTPUT_FILE_PATH);
      if (control.failDeploy) process.exit(1);
      if (!control.missingOutput) fs.writeFileSync(process.env.WRANGLER_OUTPUT_FILE_PATH, JSON.stringify({ type: 'deploy', targets: ['https://makerspace-signatures.test-account.workers.dev', 'schedule: 0 4 * * *'] }) + '\\n');
      console.log('Deployed successfully');
    }
    else process.exit(99);
  `);
  return {
    root, service,
    run: () => spawnSync(process.execPath, ['--import', './check-terminal.mjs', 'setup.mjs'], { cwd: service, encoding: 'utf8' }),
    config: () => JSON.parse(readFileSync(path.join(service, 'wrangler.jsonc'), 'utf8')),
    calls: () => readFileSync(path.join(service, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
    dispose: () => rmSync(root, { recursive: true, force: true })
  };
}

test('setup reuses the configured database without listing or recreating it', () => {
  const f = fixture(uuid, true);
  try {
    assert.equal(f.run().status, 1);
    assert.equal(f.config().d1_databases[0].database_id, uuid);
    assert.ok(!f.calls().some(args => args[0] === 'd1' && ['list', 'create'].includes(args[1])));
  } finally { f.dispose(); }
});

test('setup saves a newly created database ID before later failures and reuses it on retry', () => {
  const f = fixture('SET_BY_SETUP', true);
  try {
    assert.equal(f.run().status, 1);
    assert.equal(f.config().d1_databases[0].database_id, uuid);
    assert.deepEqual(f.calls().find(args => args[1] === 'create'), ['d1', 'create', 'makerspace-signatures', '--update-config=false', '--binding', 'DB']);
    const before = f.calls().length;
    assert.equal(f.run().status, 1);
    assert.ok(!f.calls().slice(before).some(args => args[0] === 'd1' && ['list', 'create'].includes(args[1])));
  } finally { f.dispose(); }
});

test('completed setup applies migrations, deploys and writes the service URL into the website', () => {
  const f = fixture(uuid, false);
  try {
    const result = f.run(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Connected: https:\/\/makerspace-signatures\.test-account\.workers\.dev/);
    assert.match(readFileSync(path.join(f.root, 'dist/content.js'), 'utf8'), /apiUrl: 'https:\/\/makerspace-signatures\.test-account\.workers\.dev'/);
    assert.deepEqual(f.calls().find(args => args[1] === 'migrations'), ['d1', 'migrations', 'apply', 'makerspace-signatures', '--remote']);
    assert.throws(() => readFileSync(readFileSync(path.join(f.service, 'deployment-output-path.txt'), 'utf8')), { code: 'ENOENT' });
  } finally { f.dispose(); }
});

test('failed deployment or missing deployment URL never connects the website', () => {
  for (const control of [{ failDeploy: true }, { missingOutput: true }]) {
    const f = fixture(uuid, false);
    try {
      writeFileSync(path.join(f.service, 'control.json'), JSON.stringify(control));
      const result = f.run();
      assert.equal(result.status, 1);
      assert.match(readFileSync(path.join(f.root, 'dist/content.js'), 'utf8'), /apiUrl: ''/);
      assert.throws(() => readFileSync(readFileSync(path.join(f.service, 'deployment-output-path.txt'), 'utf8')), { code: 'ENOENT' });
    } finally { f.dispose(); }
  }
});

