---
name: nuvio
description: Manage a Nuvio account, including profiles, addons, plugins, settings, collections, library, watch history, providers, trackers, and sessions. Use when a user asks to inspect or change their Nuvio account through the nuvio CLI.
---

# Nuvio CLI

Use the installed nuvio command. Discover only what the task needs:

- nuvio commands <term> lists matching commands.
- nuvio help <command> shows parameters for one command.
- Simple parameters are flags, for example: nuvio list-addons --profile-id 1.
- Complex or sensitive input goes in a JSON file with --input FILE, or through stdin with --input -. Never put passwords, PINs, provider keys, or backup JSON in shell arguments.
- Read commands return JSON. For potentially large results, pass --output FILE; stdout then gives the saved path and byte count. If the normal output exceeds the limit, repeat with --output FILE and inspect only the relevant portion.
- Use --dry-run to preview a reversible write. Destructive reversible commands preview until --confirm is passed. Irreversible commands return a short-lived confirmation_token; execute with the same arguments plus --confirmation-token TOKEN only after reviewing the preview.
- nuvio plan-operations lists commands accepted in a plan. The input JSON has an operations array of objects with a hyphenated tool name and args object. nuvio apply-plan --input FILE previews the plan; add --apply to execute it.
- nuvio list-undo, nuvio undo, and nuvio redo manage saved snapshots.

On errors, read the JSON on stderr and use the command's help. Do not retry a mutation blindly when the final state is uncertain.
