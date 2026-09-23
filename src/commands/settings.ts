import type { CommandRegistry } from '../cli/registry.js';
import type { NuvioClient } from '../nuvio/client.js';
import type { NuvioConfig } from '../config.js';
import { defineMutation, defineRead } from './helpers.js';
import { getSettingsShape, updateSettingsShape } from '../nuvio/schemas.js';
import * as settings from '../nuvio/ops/settings.js';

export function registerSettingsCommands(
  registry: CommandRegistry,
  client: NuvioClient,
  cfg: NuvioConfig
): void {
  const originId = cfg.originClientId;
  const settingsResource = (args: { profile_id: number; platform: string }) =>
    ({ kind: 'settings', profile_id: args.profile_id, platform: args.platform }) as const;
  const homeResource = (args: { profile_id: number; platform: string }) =>
    ({ kind: 'home_catalog_settings', profile_id: args.profile_id, platform: args.platform }) as const;

  defineRead(registry, client, cfg, {
    name: 'nuvio_get_settings',
    title: 'Get profile settings',
    description: 'Read the JSON settings blob for a profile on a platform.',
    risk: 'read',
    schema: getSettingsShape,
    handler: (args) => settings.getSettings(client, args.profile_id, args.platform),
  });

  defineMutation(registry, client, cfg, {
    name: 'nuvio_update_settings',
    title: 'Update profile settings',
    description:
      'Update a profile settings blob. `patch` is deep-merged (nested keys are preserved, arrays and scalars ' +
      'replace), `set` assigns nested dot paths and `unset` deletes them — applied in the order patch, set, unset.',
    risk: 'write',
    resource: settingsResource,
    schema: updateSettingsShape,
    handler: (args, ctx) =>
      settings.updateSettings(client, args.profile_id, args.platform, args, originId, ctx.apply),
  });

  defineMutation(registry, client, cfg, {
    name: 'nuvio_update_home_catalog_settings',
    title: 'Update home catalog settings',
    description:
      'Update the home screen layout/catalog blob with the same patch/set/unset semantics as nuvio_update_settings.',
    risk: 'write',
    resource: homeResource,
    schema: updateSettingsShape,
    handler: (args, ctx) =>
      settings.updateHomeCatalogSettings(client, args.profile_id, args.platform, args, originId, ctx.apply),
  });

  defineRead(registry, client, cfg, {
    name: 'nuvio_get_home_catalog_settings',
    title: 'Get home catalog settings',
    description: 'Read the home screen layout/catalog configuration for a profile on a platform.',
    risk: 'read',
    schema: getSettingsShape,
    handler: (args) => settings.getHomeCatalogSettings(client, args.profile_id, args.platform),
  });
}
