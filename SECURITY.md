# Security

## Reporting

Use a private security advisory in the onpeek/nuvio GitHub repository once it is published.

## Local data

The CLI uses NUVIO_DATA_DIR, defaulting to ~/.local/share/nuvio. The session file contains a refresh token. Snapshot files may contain prior provider credentials or tracker tokens so undo can restore them. Session and snapshot files are written with mode 0600; data directories use mode 0700. The audit log masks known secret fields.

Set NUVIO_DISABLE_SNAPSHOTS=true if raw prior credentials must not be stored. Undo will then be unavailable for new changes. Protect the data directory and any files written with --output.

## Changes and confirmation

Reversible changes capture a snapshot before writing. Destructive reversible commands require --confirm. Irreversible commands require a short-lived token obtained from a preview of the same command and arguments. The token is stored locally as a hash-named file, consumed once, and expires after five minutes. Raw arguments are represented by a hash in the pending confirmation file.

A failed write can leave the remote state uncertain. Do not retry a mutation blindly. The CLI does not automatically retry non-idempotent writes. Concurrent changes to most Nuvio resources are last-writer-wins; settings use a guarded write.

## Network

The CLI calls the configured Nuvio backend directly. Addon manifest inspection accepts only public HTTP(S) targets and checks DNS answers and redirects to prevent requests to private addresses. Backend requests have timeouts. The CLI does not expose an HTTP server.

Known secret fields are masked in command output and file exports. Masking is based on field names and cannot prove that arbitrary text never contains a secret; review files before sharing them.
