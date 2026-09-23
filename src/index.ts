#!/usr/bin/env node
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { ZodError, z } from 'zod';
import { loadConfig } from './config.js';
import { AuthManager } from './nuvio/auth.js';
import { NuvioClient } from './nuvio/client.js';
import { CommandRegistry, type Command } from './cli/registry.js';
import { registerAllCommands } from './commands/index.js';
import { isPlanSupported } from './nuvio/ops/plan.js';
import { VERSION } from './version.js';

const MAX_STDOUT_BYTES = 12_000;

function displayName(name: string): string {
  return name.replace(/^nuvio_/, '').replaceAll('_', '-');
}

function commandName(name: string): string {
  return 'nuvio_' + name.replaceAll('-', '_');
}

function fail(message: string, details?: unknown): never {
  process.stderr.write(
    JSON.stringify({ error: message, ...(details === undefined ? {} : { details }) }) + '\n'
  );
  process.exit(1);
}

function parseValue(text: string, type: string | undefined): unknown {
  if (type === 'string') return text;
  if (type === 'integer' || type === 'number') return Number(text);
  if (type === 'boolean') return text === 'true' ? true : text === 'false' ? false : text;
  if (type === 'array' || type === 'object' || text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function parseFlags(
  argv: string[],
  command: Command
): { args: Record<string, unknown>; output?: string; apply: boolean } {
  const args: Record<string, unknown> = {};
  const properties = z.toJSONSchema(command.schema).properties ?? {};
  let output: string | undefined;
  let input: string | undefined;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) fail('Unexpected positional argument: ' + token);
    const equal = token.indexOf('=');
    const flag = (equal >= 0 ? token.slice(2, equal) : token.slice(2)).replaceAll('-', '_');
    if (flag === 'apply') {
      apply = true;
      continue;
    }
    if (flag === 'confirm' || flag === 'dry_run') {
      args[flag] = equal >= 0 ? parseValue(token.slice(equal + 1), 'boolean') : true;
      continue;
    }
    const value = equal >= 0 ? token.slice(equal + 1) : argv[++i];
    if (value === undefined) fail('Missing value for --' + flag.replaceAll('_', '-'));
    if (flag === 'input') input = value;
    else if (flag === 'output') output = value;
    else args[flag] = parseValue(value, (properties[flag] as { type?: string } | undefined)?.type);
  }
  if (input) {
    const raw = input === '-' ? readFileSync(0, 'utf8') : readFileSync(input, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') fail('Input must be a JSON object');
    return { args: { ...(parsed as Record<string, unknown>), ...args }, output, apply };
  }
  return { args, output, apply };
}

function help(command: Command): unknown {
  const json = z.toJSONSchema(command.schema);
  return {
    command: 'nuvio ' + displayName(command.name),
    title: command.title,
    description: command.description,
    risk: command.risk,
    parameters: json.properties ?? {},
    required: json.required ?? [],
    input: 'Use flags for simple values or --input FILE / --input - for a JSON object.',
    output: 'JSON on stdout. Use --output FILE for large results.',
  };
}

function print(data: unknown, output?: { path: string; fd: number }): void {
  const json = JSON.stringify(data);
  if (output) {
    writeFileSync(output.fd, json + '\n');
    process.stdout.write(JSON.stringify({ saved_to: output.path, bytes: Buffer.byteLength(json) }) + '\n');
    return;
  }
  if (Buffer.byteLength(json) > MAX_STDOUT_BYTES) {
    const result =
      data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    process.stdout.write(
      JSON.stringify({
        truncated: true,
        bytes: Buffer.byteLength(json),
        status: result.status,
        snapshot_id: result.snapshot_id,
        hint: 'Repeat a read with --output FILE for the full result.',
      }) + '\n'
    );
    return;
  }
  process.stdout.write(json + '\n');
}

async function main(): Promise<void> {
  const [verb, ...rest] = process.argv.slice(2);
  if (verb === '--version' || verb === 'version') {
    print({ version: VERSION });
    return;
  }
  const cfg = loadConfig();
  const auth = new AuthManager({
    backendUrl: cfg.backendUrl,
    publishableKey: cfg.publishableKey,
    email: cfg.email,
    password: cfg.password,
    refreshToken: cfg.refreshToken,
    sessionFile: cfg.sessionFile,
    timeoutMs: Math.min(cfg.backendTimeoutMs, 15_000),
  });
  const client = new NuvioClient(cfg, auth);
  const registry = new CommandRegistry();
  registerAllCommands(registry, client, cfg);

  if (!verb || verb === 'help' || verb === '--help') {
    const selected = rest[0] && registry.get(commandName(rest[0]));
    print(
      selected
        ? help(selected)
        : {
            usage:
              'nuvio <command> [--flags] | nuvio help <command> | nuvio commands [search] | nuvio plan-operations',
            examples: [
              'nuvio list-profiles',
              'nuvio list-addons --profile-id 1',
              'nuvio help update-settings',
            ],
            commands: 'Run nuvio commands <search> to discover commands by name or description.',
          }
    );
    return;
  }
  if (verb === 'commands') {
    const query = rest.join(' ').toLowerCase();
    print(
      registry
        .list()
        .filter((c) => (c.name + ' ' + c.title + ' ' + c.description).toLowerCase().includes(query))
        .map((c) => ({ command: displayName(c.name), title: c.title, risk: c.risk }))
    );
    return;
  }
  if (verb === 'plan-operations') {
    print(
      registry
        .list()
        .filter((c) => isPlanSupported(c.name))
        .map((c) => displayName(c.name))
    );
    return;
  }
  const command = registry.get(commandName(verb));
  if (!command) fail('Unknown command. Run nuvio commands <search> to find one.');
  if (rest.includes('--help')) {
    print(help(command));
    return;
  }
  const { args, output, apply } = parseFlags(rest, command);
  if (apply) {
    if (command.name !== 'nuvio_apply_plan') fail('--apply is only valid for apply-plan');
    args.dry_run = false;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = command.schema.strict().parse(args) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ZodError) fail('Invalid command arguments', error.issues);
    throw error;
  }
  const fd = output ? openSync(output, 'wx', 0o600) : undefined;
  let completed = false;
  try {
    print(await command.run(parsed), output && fd !== undefined ? { path: output, fd } : undefined);
    completed = true;
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (!completed && output) unlinkSync(output);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
