# Private deployment variables and storage bindings

Storage bindings must be included on every deployment. `keep_vars = true` preserves
runtime text/JSON variables, not D1, KV or R2 bindings added in the dashboard.

`mail-worker/wrangler.toml` and `mail-worker/wrangler-action.toml` are templates.
Their storage bindings contain variable names, never real resource identifiers. Wrangler does not expand `${VARIABLE}` placeholders itself.
Use the generator below before deploying; do not deploy a template directly.

## Required private build inputs

Configure all four variables for the intended deployment environment:

- `D1_DATABASE_NAME`: the existing D1 database name.
- `D1_DATABASE_ID`: the existing D1 database UUID.
- `KV_NAMESPACE_ID`: the existing KV namespace ID.
- `R2_BUCKET_NAME`: the existing R2 bucket name.

Use Cloudflare **Settings > Builds > Variables and secrets**, with the secret type
to mask values in build logs. These are build inputs, not the Worker's runtime
variables. Do not create new credentials or change existing access permissions
just to supply these resource identifiers. Keep API tokens and runtime secrets in
their existing secret stores; never commit them.

The generator requires every binding and stops on missing or invalid values.
It does not call Cloudflare, create resources, or remove optional-looking bindings.
R2 is required in this deployment path to prevent attachment storage from silently
falling back to another backend. If an environment intentionally has no R2 bucket,
review that deployment separately instead of passing an empty value.

## Cloudflare Workers Builds

The [official dashboard update flow](https://docs.skymail.ink/deployment/update)
synchronizes the fork and lets Workers Builds update the Worker automatically.
Apply the settings below to that existing linked Worker, not just a manual shell
command. A draft pull request or a local dry-run does not change this update path;
the source change and the build settings must both be installed before it is protected.

Before enabling this path, review the production branch and non-production build
settings. The legacy `wrangler versions upload` preview command uses the resources
configured in that version and does not isolate production storage. Do not supply
production inputs to branch or untrusted pull-request builds. Use separately
approved, isolated preview resources, or keep automatic non-production uploads off.
Do not change build controls, secrets or permissions without the owner's approval.

After configuring the required build inputs:

- Keep the root directory at `mail-worker`.
- Build command: `pnpm --dir ../mail-vue install --frozen-lockfile && pnpm --dir ../mail-vue run build`.
- Production deploy command: `node scripts/render-deploy-config.mjs && npx wrangler deploy --config wrangler.generated.toml`.

Keep this explicit command in Cloudflare settings rather than relying on an
upstream `package.json` deploy script. If an upstream reset removes the generator,
the command fails before Wrangler runs instead of falling back to an unguarded
deploy. Ordinary upstream merges should retain local changes, but conflicts,
force-resets and upstream workflow changes require review. Do not bypass a failed
generation or replace this command with a direct template deployment.

The generator creates `mail-worker/wrangler.generated.toml`, then the command explicitly
passes it to Wrangler. It retains the template's AI/assets bindings, variables,
cron configuration and build settings. Configuring build variables alone is not
enough: the deploy command must also use the generated configuration.

These are setup instructions, not authorization to deploy. Merging a code change
is separate from changing build settings or starting a production deployment.

## GitHub Actions

Set the same four inputs in repository/environment secrets (repository variables
are also accepted by the existing workflow). The workflow performs its existing
runtime-variable setup, then uses the same generator with `wrangler-action.toml`.
It no longer finds or creates D1/KV resources by the Worker name, and a missing R2
input no longer removes the binding. Existing runtime setup requirements still
apply. Do not make both CI systems production deployers unless that is intentional.

## Upstream updates and optional email forwarding

The optional `forward` email binding is disabled in the deployment templates.
Enable it only when the owner has approved external forwarding and its destination
restrictions. This does not disable the existing inbound email forwarding route.
Before upgrading application code, review required database migrations and preserve
a recovery point. Apply additive schema changes before sending traffic to code that
requires them; do not assume an initialization endpoint returning success proves
every migration completed.

## Local validation and generated files

Export the required inputs in your local shell without committing them, then run
from `mail-worker`:

```sh
pnpm run prepare:deploy
pnpm exec wrangler deploy --config wrangler.generated.toml --dry-run
```

The generator creates the file with owner-only permissions and replaces it
atomically. A failed generation removes any previous generated configuration so
it cannot be reused accidentally. Do not invoke Wrangler after generation fails.

`wrangler.generated.toml` and private local environment files are ignored by Git.
Never force-add them, upload them as build artifacts, or move them under `dist`:
`dist` is served as public static assets. Wrangler may print resource identifiers;
keep validation logs private and do not paste them into public pull requests.

References:
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
