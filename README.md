<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/nuvio-wordmark-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/nuvio-wordmark-light.png" />
    <img src="assets/nuvio-wordmark-light.png" alt="Nuvio CLI" width="400" />
  </picture>

  <p>
    <strong>Manage your Nuvio account from a terminal or coding agent.</strong><br />
    Profiles · Addons · Plugins · Settings · Collections · Library · Providers · Trackers
  </p>

  <p>
    <a href="https://github.com/onpeek/nuvio/actions/workflows/ci.yml"><img src="https://github.com/onpeek/nuvio/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://www.npmjs.com/package/@onpeek/nuvio"><img src="https://img.shields.io/npm/v/@onpeek/nuvio?style=flat&color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js 20 or newer" />
    <a href="LICENSE"><img src="https://img.shields.io/github/license/onpeek/nuvio?style=flat&color=6366f1" alt="MIT license" /></a>
  </p>

  <p><em>Unofficial community project. Not affiliated with or endorsed by Nuvio.</em></p>

</div>

---

## Features

- 64 commands, discovered on demand with <code>nuvio commands</code> and <code>nuvio help</code>
- Manage profiles, addons, plugins, settings, collections, library, watch history, providers, and trackers
- Preview changes, keep snapshots, and undo reversible writes
- Confirm irreversible operations with a short-lived token
- Save large results to a file instead of filling agent context
- Requires Node.js 20 or newer.

## Install

```bash
git clone https://github.com/onpeek/nuvio.git
cd nuvio
npm ci
npm run build
npm link
npx skills add onpeek/nuvio --skill nuvio
```

Set <code>NUVIO_EMAIL</code> and <code>NUVIO_PASSWORD</code>, or set
<code>NUVIO_REFRESH_TOKEN</code>. The CLI stores its session locally. Use
<code>NUVIO_BACKEND_URL</code> for a self-hosted backend.

## Use

```bash
nuvio commands profile
nuvio help update-settings
nuvio list-profiles
nuvio list-addons --profile-id 1
```

Pass simple values as flags. For arrays, objects, PINs, or provider keys, use
<code>--input FILE</code> or <code>--input -</code> with JSON. Keep credentials
and secrets out of shell arguments.

Preview a change, then apply it:

```bash
nuvio update-settings --input settings-edit.json --dry-run
nuvio update-settings --input settings-edit.json
nuvio undo --snapshot-id SNAPSHOT_ID
```

Normal stdout is capped at 12,000 bytes. Use <code>--output FILE</code> to save
a full result. See [SECURITY.md](SECURITY.md) for local data and confirmation details.

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

[MIT](LICENSE)
