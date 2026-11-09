import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep generated configuration beside the template so relative paths stay valid.
// Never write it under dist: that directory is uploaded as public static assets.
const workerDirectory = new URL('../', import.meta.url);
const output = new URL('wrangler.generated.toml', workerDirectory);
const temporary = new URL(`wrangler.generated.toml.${randomUUID()}.tmp`, workerDirectory);
const templates = new Set(['wrangler.toml', 'wrangler-action.toml']);
const variables = {
  D1_DATABASE_NAME: /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/,
  D1_DATABASE_ID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  KV_NAMESPACE_ID: /^[a-f0-9]{32}$/i,
  R2_BUCKET_NAME: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
};

try {
  // A failed or interrupted generation must never leave a stale deployment target.
  rmSync(output, { force: true });
  const templateName = process.argv[2] ?? 'wrangler.toml';
  if (process.argv.length > 3 || !templates.has(templateName)) {
    throw new Error('Usage: node scripts/render-deploy-config.mjs [wrangler.toml|wrangler-action.toml]');
  }
  let config = readFileSync(new URL(templateName, workerDirectory), 'utf8');
  for (const [name, pattern] of Object.entries(variables)) {
    const value = process.env[name];
    if (!value || value !== value.trim() || !pattern.test(value)) {
      // Report the variable name only; identifiers and secrets must not enter logs.
      throw new Error(`Missing or invalid build variable: ${name}`);
    }
    const placeholder = `"\${${name}}"`;
    if (config.split(placeholder).length !== 2) {
      throw new Error(`Expected exactly one quoted placeholder for ${name}`);
    }
    config = config.replace(placeholder, JSON.stringify(value));
  }
  if (/\$\{[A-Z_][A-Z0-9_]*\}/.test(config)) {
    throw new Error('Unresolved template variables; complete environment setup before generation');
  }
  writeFileSync(temporary, config, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, output);
  console.log(`Generated ${fileURLToPath(output).split('/').pop()} with all required storage bindings.`);
} catch (error) {
  rmSync(temporary, { force: true });
  console.error(error.message);
  process.exitCode = 1;
}
