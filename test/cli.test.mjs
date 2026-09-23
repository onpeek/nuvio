import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMockNuvio } from './mock-nuvio.mjs';

const exec = promisify(execFile);
const dataDir = mkdtempSync(join(tmpdir(), 'nuvio-cli-'));
let mock;

before(async () => {
  mock = await startMockNuvio();
});
after(async () => {
  await mock?.close();
});

async function cli(...args) {
  const result = await exec('node', ['dist/index.js', ...args], {
    env: {
      ...process.env,
      NUVIO_BACKEND_URL: mock.url,
      NUVIO_PUBLISHABLE_KEY: 'test-key',
      NUVIO_EMAIL: 'mock@example.com',
      NUVIO_PASSWORD: 'mock-password',
      NUVIO_DATA_DIR: dataDir,
    },
  });
  return JSON.parse(result.stdout);
}

test('CLI exposes canonical commands without legacy aliases or MCP', async () => {
  const commands = await cli('commands');
  assert.equal(commands.length, 64);
  assert.ok(commands.some((c) => c.command === 'update-settings'));
  assert.ok(!commands.some((c) => c.command === 'set-setting'));
  const help = await cli('help', 'update-settings');
  assert.equal(help.command, 'nuvio update-settings');
  assert.ok(help.parameters.profile_id);
});

test('CLI reads account state and saves full output to a file', async () => {
  const profiles = await cli('list-profiles');
  assert.equal(profiles[0].name, 'Main');
  const file = join(dataDir, 'profiles.json');
  const saved = await cli('list-profiles', '--output', file);
  assert.equal(saved.saved_to, file);
  assert.equal(JSON.parse(readFileSync(file, 'utf8'))[0].name, 'Main');
});

test('CLI mutation preview, apply and undo work across processes', async () => {
  const input = join(dataDir, 'settings-edit.json');
  writeFileSync(
    input,
    JSON.stringify({ profile_id: 1, platform: 'tv', set: [{ path: 'theme', value: 'blue' }] })
  );
  const preview = await cli('update-settings', '--input', input, '--dry-run');
  assert.equal(preview.status, 'preview');
  assert.equal(
    (await cli('get-settings', '--profile-id', '1', '--platform', 'tv')).settings_json.theme,
    'dark'
  );
  const applied = await cli('update-settings', '--input', input);
  assert.equal(applied.status, 'applied');
  assert.ok(applied.snapshot_id);
  assert.equal(
    (await cli('get-settings', '--profile-id', '1', '--platform', 'tv')).settings_json.theme,
    'blue'
  );
  await cli('undo', '--snapshot-id', applied.snapshot_id);
  assert.equal(
    (await cli('get-settings', '--profile-id', '1', '--platform', 'tv')).settings_json.theme,
    'dark'
  );
});

test('irreversible confirmation token survives a new CLI process and is single use', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const preview = await cli('revoke-session', '--session-id', id);
  assert.equal(preview.status, 'preview');
  assert.ok(preview.confirmation_token);
  const applied = await cli(
    'revoke-session',
    '--session-id',
    id,
    '--confirmation-token',
    preview.confirmation_token
  );
  assert.equal(applied.status, 'applied');
  await assert.rejects(() =>
    cli('revoke-session', '--session-id', id, '--confirmation-token', preview.confirmation_token)
  );
});

test('large reads stay out of stdout and remain available through file output', async () => {
  mock.store.library[1] = Array.from({ length: 100 }, (_, i) => ({
    content_id: 'tt' + String(i).padStart(7, '0'),
    content_type: 'movie',
    name: 'A fairly long library entry ' + i,
    description: 'x'.repeat(120),
  }));
  const short = await cli('get-library', '--profile-id', '1');
  assert.equal(short.truncated, true);
  assert.ok(short.bytes > 12_000);
  const path = join(dataDir, 'library.json');
  await cli('get-library', '--profile-id', '1', '--output', path);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).length, 100);
});

test('addon and collection commands retain their existing operations', async () => {
  const addonUrl = 'https://example.com/a/manifest.json';
  const updated = await cli('update-addon', '--profile-id', '1', '--url', addonUrl, '--name', 'Renamed');
  assert.equal(updated.status, 'applied');
  assert.equal((await cli('list-addons', '--profile-id', '1'))[0].name, 'Renamed');

  const input = join(dataDir, 'collection.json');
  writeFileSync(
    input,
    JSON.stringify({ profile_id: 1, collection: { id: 'test', title: 'Test collection' } })
  );
  assert.equal((await cli('create-collection', '--input', input)).status, 'applied');
  assert.equal((await cli('list-collections', '--profile-id', '1'))[0].title, 'Test collection');
});

test('plan previews and applies several operations in one call', async () => {
  const path = join(dataDir, 'plan.json');
  writeFileSync(
    path,
    JSON.stringify({
      operations: [
        {
          tool: 'update-settings',
          args: { profile_id: 1, platform: 'tv', set: [{ path: 'theme', value: 'green' }] },
        },
        {
          tool: 'add-to-library',
          args: {
            profile_id: 1,
            items: [{ content_id: 'tt9999999', content_type: 'movie', name: 'Plan item' }],
          },
        },
      ],
    })
  );
  const preview = await cli('apply-plan', '--input', path);
  assert.equal(preview.status, 'preview');
  const applied = await cli('apply-plan', '--input', path, '--apply');
  assert.equal(applied.status, 'applied');
  assert.ok(applied.snapshot_id);
  assert.equal(
    (await cli('get-settings', '--profile-id', '1', '--platform', 'tv')).settings_json.theme,
    'green'
  );
  assert.ok(mock.store.library[1].some((item) => item.content_id === 'tt9999999'));
});
