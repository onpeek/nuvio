import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface NuvioConfig {
  backendUrl: string;
  publishableKey: string;
  email?: string;
  password?: string;
  refreshToken?: string;
  originClientId: string;
  sessionFile: string;
  auditFile: string;
  snapshotDir: string;
  /** Timeout for outbound requests to the Nuvio backend. */
  backendTimeoutMs: number;
  /** When true, no snapshots are written and reversible changes cannot be undone. */
  disableSnapshots: boolean;
  /** Automatic snapshot retention limits (best-effort GC after every write). */
  snapshotMaxAgeDays: number;
  snapshotMaxCount: number;
  snapshotMaxTotalBytes: number;
}

const OFFICIAL_PUBLISHABLE_KEY = 'sb_publishable_1Clq8rlTVACkdcZuqr6_AD__xUUC_EN';

function loadEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  // Only package-relative .env files: never the current working directory.
  const candidates = [resolve(here, '..', '.env'), resolve(here, '..', '..', '.env')];
  const load = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof load !== 'function') return;
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      load(file);
    } catch {
      /* ignore malformed env files */
    }
  }
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Like `int`, but `0` is a valid value (used where 0 means "disabled"). */
function nonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadConfig(): NuvioConfig {
  loadEnvFiles();

  const dataDir =
    process.env.NUVIO_DATA_DIR?.trim() ||
    (process.env.XDG_DATA_HOME
      ? join(process.env.XDG_DATA_HOME, 'nuvio')
      : join(homedir(), '.local', 'share', 'nuvio'));

  return {
    backendUrl: (process.env.NUVIO_BACKEND_URL ?? 'https://api.nuvio.tv').replace(/\/+$/, ''),
    publishableKey: process.env.NUVIO_PUBLISHABLE_KEY?.trim() || OFFICIAL_PUBLISHABLE_KEY,
    email: process.env.NUVIO_EMAIL?.trim() || undefined,
    password: process.env.NUVIO_PASSWORD || undefined,
    refreshToken: process.env.NUVIO_REFRESH_TOKEN?.trim() || undefined,
    originClientId: process.env.NUVIO_ORIGIN_CLIENT_ID?.trim() || 'nuvio-cli',
    sessionFile: process.env.NUVIO_SESSION_FILE?.trim() || join(dataDir, 'session.json'),
    auditFile: process.env.NUVIO_AUDIT_FILE?.trim() || join(dataDir, 'audit.jsonl'),
    snapshotDir: process.env.NUVIO_SNAPSHOT_DIR?.trim() || join(dataDir, 'snapshots'),
    backendTimeoutMs: int(process.env.NUVIO_BACKEND_TIMEOUT_MS, 30_000),
    disableSnapshots: bool(process.env.NUVIO_DISABLE_SNAPSHOTS, false),
    snapshotMaxAgeDays: nonNegativeInt(process.env.NUVIO_SNAPSHOT_MAX_AGE_DAYS, 30),
    snapshotMaxCount: nonNegativeInt(process.env.NUVIO_SNAPSHOT_MAX_COUNT, 250),
    snapshotMaxTotalBytes: nonNegativeInt(process.env.NUVIO_SNAPSHOT_MAX_TOTAL_BYTES, 50 * 1024 * 1024),
  };
}
