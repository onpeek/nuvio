# Nuvio CLI

Manage your Nuvio account from a terminal or a coding agent. This is an unofficial community project, not affiliated with Nuvio.

The package provides one CLI and a small agent skill. Commands are discovered on demand, so an agent does not need the complete command catalogue in its context.

## Install

Requires Node.js 20 or newer. The intended npm package is @onpeek/nuvio:

    npm install -g @onpeek/nuvio

Install the agent skill from the GitHub repository after it is published:

    npx skills add onpeek/nuvio --skill nuvio

From source:

    npm ci
    npm run build
    node dist/index.js help

## Authenticate

Set NUVIO_EMAIL and NUVIO_PASSWORD in the environment, or set NUVIO_REFRESH_TOKEN. The CLI saves a session under NUVIO_DATA_DIR (default: ~/.local/share/nuvio). Use NUVIO_BACKEND_URL for a self-hosted backend.

Do not pass passwords, PINs, API keys, or backup contents as shell arguments. Use environment variables for account credentials and --input FILE or --input - for sensitive command input.

## Discover commands

    nuvio commands profile
    nuvio help update-settings
    nuvio list-profiles
    nuvio list-addons --profile-id 1

Commands accept simple values as --kebab-case flags. Arrays, objects, and sensitive values can be supplied as one JSON object with --input FILE or --input -. The file and flags are validated against the command schema. All normal output is JSON on stdout; errors are JSON on stderr with a nonzero exit code.

## Change data

    nuvio update-settings --input settings-edit.json --dry-run
    nuvio update-settings --input settings-edit.json

Reversible writes create a local snapshot. Destructive reversible commands return a preview until --confirm is supplied. Irreversible commands first return a single-use confirmation token that expires after five minutes; repeat the same command with --confirmation-token TOKEN to apply it. Use nuvio list-undo, nuvio undo, and nuvio redo for reversible changes.

The apply-plan command previews by default and supports --apply after review. Use nuvio plan-operations to see supported commands. A plan file contains an operations array; each entry has a hyphenated tool name and an args object. Run nuvio help apply-plan for its input structure.

## Large results

Normal stdout is capped at 12 KB to protect an agent's context. Save a full result to a new file with --output FILE:

    nuvio export-backup --output backup.json

The CLI prints only the path and byte count when saving a file. Files are created with mode 0600 and are never overwritten. The saved result is still masked for known secret fields. The backend excludes credentials from account backups.

## Capabilities

Profiles, addons, plugins, settings, home catalog settings, collections, library, watch progress and history, provider credentials, trackers, sessions, account backup, snapshots, undo, and multi-step plans.

See SECURITY.md for local data and safety details. See LICENSE for the MIT license and original copyright notice.
