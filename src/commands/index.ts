import type { CommandRegistry } from '../cli/registry.js';
import type { NuvioClient } from '../nuvio/client.js';
import type { NuvioConfig } from '../config.js';
import { definePlanMutation } from './helpers.js';
import { registerProfileCommands } from './profiles.js';
import { registerAddonCommands } from './addons.js';
import { registerPluginCommands } from './plugins.js';
import { registerSettingsCommands } from './settings.js';
import { registerCollectionCommands } from './collections.js';
import { registerLibraryCommands } from './library.js';
import { registerProviderCommands } from './providers.js';
import { registerTrackerCommands } from './trackers.js';
import { registerSessionCommands } from './sessions.js';
import { registerAccountCommands } from './account.js';
import { registerUndoCommands } from './undo.js';

export function registerAllCommands(registry: CommandRegistry, client: NuvioClient, cfg: NuvioConfig): void {
  registerProfileCommands(registry, client, cfg);
  registerAddonCommands(registry, client, cfg);
  registerPluginCommands(registry, client, cfg);
  registerSettingsCommands(registry, client, cfg);
  registerCollectionCommands(registry, client, cfg);
  registerLibraryCommands(registry, client, cfg);
  registerProviderCommands(registry, client, cfg);
  registerTrackerCommands(registry, client, cfg);
  registerSessionCommands(registry, client, cfg);
  registerAccountCommands(registry, client, cfg);
  registerUndoCommands(registry, client, cfg);
  definePlanMutation(registry, client, cfg);
}
