import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { NuvioConfig } from '../config.js';

interface Pending {
  command: string;
  fingerprint: string;
  expires_at: number;
}

const TTL_MS = 5 * 60_000;

function fingerprint(command: string, args: Record<string, unknown>): string {
  const clean = Object.fromEntries(
    Object.entries(args)
      .filter(([key]) => !['confirmation_token', 'confirm', 'dry_run'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return createHash('sha256')
    .update(JSON.stringify({ command, args: clean }))
    .digest('hex');
}

function pendingPath(cfg: NuvioConfig, token: string): string {
  const id = createHash('sha256').update(token).digest('hex');
  return join(dirname(cfg.sessionFile), 'confirm-' + id + '.json');
}

export function prepareConfirmation(
  cfg: NuvioConfig,
  command: string,
  args: Record<string, unknown>
): { confirmation_token: string; expires_at: string } {
  const token = randomBytes(24).toString('base64url');
  const expires = Date.now() + TTL_MS;
  const file = pendingPath(cfg, token);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(
    file,
    JSON.stringify({
      command,
      fingerprint: fingerprint(command, args),
      expires_at: expires,
    } satisfies Pending),
    { flag: 'wx', mode: 0o600 }
  );
  return { confirmation_token: token, expires_at: new Date(expires).toISOString() };
}

export function verifyConfirmation(
  cfg: NuvioConfig,
  command: string,
  args: Record<string, unknown>,
  token: unknown
): void {
  if (typeof token !== 'string' || token.length < 20)
    throw new Error('Missing confirmation token. Run the command once without it to preview.');
  const file = pendingPath(cfg, token);
  let pending: Pending;
  try {
    pending = JSON.parse(readFileSync(file, 'utf8')) as Pending;
    unlinkSync(file);
  } catch {
    throw new Error('Confirmation token not found or already used. Preview the command again.');
  }
  if (pending.command !== command || pending.fingerprint !== fingerprint(command, args))
    throw new Error('Confirmation token does not match the command arguments.');
  if (pending.expires_at <= Date.now())
    throw new Error('Confirmation token expired. Preview the command again.');
}
