import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { CommandRegistry, CommandRisk } from '../cli/registry.js';
import { prepareConfirmation, verifyConfirmation } from '../cli/confirmation.js';
import type { NuvioClient } from '../nuvio/client.js';
import type { NuvioConfig } from '../config.js';
import type { ApplyResult } from '../nuvio/types.js';
import { withCallCache } from '../nuvio/call-context.js';
import {
  capture,
  captureComposite,
  readResource,
  removeSnapshot,
  restoreResource,
  type ResourceRef,
  type Snapshot,
} from '../nuvio/snapshots.js';
import { applyPlan, type PlanOperation } from '../nuvio/ops/plan.js';
import { maskDeep } from '../mask.js';

export type Risk = CommandRisk;

export interface ExecCtx {
  client: NuvioClient;
  config: NuvioConfig;
  apply: boolean;
  dryRun: boolean;
  before: unknown;
  read: (ref: ResourceRef) => Promise<unknown>;
}

interface CommonSpec<S extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  schema: S;
  annotations?: Record<string, boolean>;
}

export interface ReadSpec<S extends z.ZodRawShape> extends CommonSpec<S> {
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ExecCtx) => Promise<unknown> | unknown;
}

export interface MutationSpec<S extends z.ZodRawShape> extends CommonSpec<S> {
  resource: ResourceRef | ((args: z.infer<z.ZodObject<S>>) => ResourceRef);
  scope?: (args: z.infer<z.ZodObject<S>>) => unknown;
  reversible?: boolean;
  note?: string;
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ExecCtx) => Promise<ApplyResult<unknown>>;
}

export interface LocalMutationSpec<S extends z.ZodRawShape> extends CommonSpec<S> {
  handler: (
    args: z.infer<z.ZodObject<S>>,
    ctx: ExecCtx
  ) => Promise<{ changed: boolean; applied: boolean; diff: string[] }>;
}

const AUDIT_MAX_BYTES = 5 * 1024 * 1024;

function audit(cfg: NuvioConfig, entry: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(cfg.auditFile), { recursive: true, mode: 0o700 });
    try {
      if (statSync(cfg.auditFile).size > AUDIT_MAX_BYTES) renameSync(cfg.auditFile, cfg.auditFile + '.1');
    } catch {
      /* first write */
    }
    appendFileSync(
      cfg.auditFile,
      JSON.stringify({ ts: new Date().toISOString(), ...(maskDeep(entry) as Record<string, unknown>) }) +
        '\n',
      { mode: 0o600 }
    );
  } catch {
    /* best effort */
  }
}

function ctx(
  client: NuvioClient,
  cfg: NuvioConfig,
  apply: boolean,
  dryRun: boolean,
  before?: unknown
): ExecCtx {
  return { client, config: cfg, apply, dryRun, before, read: (ref) => readResource(client, ref) };
}

export function defineRead<S extends z.ZodRawShape>(
  registry: CommandRegistry,
  client: NuvioClient,
  cfg: NuvioConfig,
  spec: ReadSpec<S>
): void {
  registry.register({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    risk: spec.risk,
    schema: z.object(spec.schema),
    run: async (raw) =>
      withCallCache(async () =>
        maskDeep(await spec.handler(raw as z.infer<z.ZodObject<S>>, ctx(client, cfg, true, false)))
      ),
  });
}

export function defineMutation<S extends z.ZodRawShape>(
  registry: CommandRegistry,
  client: NuvioClient,
  cfg: NuvioConfig,
  spec: MutationSpec<S>
): void {
  const reversible = spec.reversible ?? true;
  const schema = z.object({
    ...spec.schema,
    dry_run: z.boolean().optional(),
    ...(!reversible
      ? { confirmation_token: z.string().optional() }
      : spec.risk === 'destructive'
        ? { confirm: z.boolean().optional() }
        : {}),
  });
  registry.register({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    risk: spec.risk,
    schema,
    run: async (raw) =>
      withCallCache(async () => {
        const args = raw as z.infer<z.ZodObject<S>>;
        const dryRun = raw.dry_run === true;
        const apply =
          !dryRun &&
          (reversible
            ? spec.risk !== 'destructive' || raw.confirm === true
            : typeof raw.confirmation_token === 'string');
        if (apply && !reversible) verifyConfirmation(cfg, spec.name, raw, raw.confirmation_token);
        const resource = typeof spec.resource === 'function' ? spec.resource(args) : spec.resource;
        let before: unknown;
        let snapshot: Snapshot | undefined;
        if (apply && reversible && !cfg.disableSnapshots) {
          before = await readResource(client, resource);
          snapshot = capture(cfg, client, {
            tool: spec.name,
            resource,
            before,
            reversible: true,
            note: spec.note,
            scope: spec.scope?.(args),
          });
        }
        let result: ApplyResult<unknown>;
        try {
          result = await spec.handler(args, ctx(client, cfg, apply, dryRun, before));
        } catch (error) {
          if (snapshot) removeSnapshot(cfg, snapshot.id);
          throw error;
        }
        if (snapshot && !(result.applied && result.changed)) removeSnapshot(cfg, snapshot.id);
        if (result.applied && result.changed)
          audit(cfg, { command: spec.name, resource, args, diff: result.diff, snapshot: snapshot?.id });
        const confirmation =
          !reversible && !apply && !dryRun && result.changed
            ? prepareConfirmation(cfg, spec.name, raw)
            : undefined;
        return {
          status: !result.changed ? 'unchanged' : result.applied ? 'applied' : 'preview',
          changed: result.changed,
          diff: maskDeep(result.diff),
          ...(snapshot && result.applied && result.changed ? { snapshot_id: snapshot.id } : {}),
          ...(confirmation
            ? {
                warning:
                  'Irreversible. Run again with --confirmation-token TOKEN and the same arguments to apply.',
                ...confirmation,
              }
            : {}),
          ...(spec.risk === 'destructive' && !apply && !dryRun
            ? { hint: 'Run again with --confirm to apply.' }
            : {}),
        };
      }),
  });
}

export function defineLocalMutation<S extends z.ZodRawShape>(
  registry: CommandRegistry,
  client: NuvioClient,
  cfg: NuvioConfig,
  spec: LocalMutationSpec<S>
): void {
  registry.register({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    risk: spec.risk,
    schema: z.object({ ...spec.schema, dry_run: z.boolean().optional(), confirm: z.boolean().optional() }),
    run: async (raw) => {
      const apply = raw.confirm === true && raw.dry_run !== true;
      const result = await spec.handler(raw as z.infer<z.ZodObject<S>>, ctx(client, cfg, apply, !apply));
      if (result.applied && result.changed) audit(cfg, { command: spec.name, args: raw, diff: result.diff });
      return {
        status: !result.changed ? 'unchanged' : result.applied ? 'applied' : 'preview',
        changed: result.changed,
        diff: maskDeep(result.diff),
      };
    },
  });
}

export function definePlanMutation(registry: CommandRegistry, client: NuvioClient, cfg: NuvioConfig): void {
  registry.register({
    name: 'nuvio_apply_plan',
    title: 'Apply a plan of operations',
    description:
      'Apply supported operations together with a composite snapshot and rollback. Preview by default.',
    risk: 'write',
    schema: z.object({
      operations: z
        .array(z.object({ tool: z.string().min(1), args: z.record(z.string(), z.unknown()).default({}) }))
        .min(1),
      dry_run: z.boolean().optional().default(true),
    }),
    run: async (raw) =>
      withCallCache(async () => {
        const operations = (raw.operations as PlanOperation[]).map((op) => ({
          ...op,
          tool: 'nuvio_' + op.tool.replaceAll('-', '_'),
        }));
        const result = await applyPlan(operations, raw.dry_run !== false, {
          client,
          originId: cfg.originClientId,
          snapshotsDisabled: cfg.disableSnapshots,
          captureComposite: (entries) =>
            cfg.disableSnapshots
              ? undefined
              : captureComposite(cfg, client, {
                  tool: 'nuvio_apply_plan',
                  entries,
                  reversible: true,
                  note: 'composite snapshot for a plan',
                }).id,
          restoreEntry: async (entry) => {
            await restoreResource(client, cfg, entry, {
              id: 'nuvio_apply_plan',
              tool: 'nuvio_apply_plan',
              reversible: true,
            } as Snapshot);
          },
        });
        if (['applied', 'rolled_back', 'partially_applied'].includes(result.status))
          audit(cfg, { command: 'nuvio_apply_plan', operations, result });
        return maskDeep({
          ...result,
          operations: result.operations.map((op) => ({
            ...op,
            tool: op.tool.replace(/^nuvio_/, '').replaceAll('_', '-'),
          })),
          failed_operation: result.failed_operation && {
            ...result.failed_operation,
            tool: result.failed_operation.tool.replace(/^nuvio_/, '').replaceAll('_', '-'),
          },
        });
      }),
  });
}
