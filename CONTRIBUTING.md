# Contributing

This is an unofficial Nuvio community project.

## Setup

    npm ci
    npm run build
    npm test
    npm run typecheck
    npm run lint
    npm run format:check

Tests use an in-memory Nuvio backend and do not need a real account.

Command definitions live in src/commands, shared operation logic in src/nuvio, and the CLI parser in src/index.ts. Register commands through the helpers so previews, snapshots, audit entries, and confirmation remain consistent. Add a meaningful integration test for changed command behavior. Keep the agent skill short and use command help for detailed parameters.

Do not commit credentials, session files, snapshots, or backups.
