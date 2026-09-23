# Release on onpeek

This repository is prepared for a new GitHub repository named onpeek/nuvio and the public npm package @onpeek/nuvio. Do not push this branch to the old wiktorekdev/nuvio-mcp remote.

## First release

1. Authenticate GitHub CLI as onpeek and npm CLI as an account with publishing rights to the @onpeek scope. Verify with gh auth status and npm whoami.
2. Create a fresh public GitHub repository onpeek/nuvio and push a reviewed commit of this source. Preserve the LICENSE file, which includes the original project's MIT notice.
3. Run npm ci, npm run typecheck, npm run lint, npm run format:check, npm test, and npm pack --dry-run. Confirm that the package includes dist and skills/nuvio but no MCP artifacts or secrets.
4. Publish the first package version while authenticated to npm with npm publish --access public. npm may require a second factor. See the npm documentation for public scoped packages.
5. Configure npm Trusted Publishing for GitHub Actions: account onpeek, repository nuvio, workflow publish.yml, with direct publishing allowed. The existing workflow can publish later versions using OIDC.
6. Push tag v1.0.0 to create the GitHub release. The workflow recognizes the already published npm version and skips a duplicate publish.

For later versions, update package.json and the changelog, run the checks, and push a matching vX.Y.Z tag after the Trusted Publisher is configured.
