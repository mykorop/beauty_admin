// Runs after `build:staging` / `build:prod`, whose source maps are hidden: the bundles do not point
// at them, but Angular still writes them next to the bundles. With SENTRY_AUTH_TOKEN set, the
// bundles get Sentry debug ids and the maps go to Sentry, which reads stack traces through them.
// Either way every `.map` is then deleted, so the folder uploaded to hosting serves none.
//
// sentry-cli takes the rest of its settings from the environment: SENTRY_ORG and SENTRY_PROJECT
// (an organisation token carries the organisation and its region already), SENTRY_URL if needed.
// Each may also sit in the gitignored `.env` at the repo root; a variable already set in the shell wins.
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SentryCli } from '@sentry/cli';

try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const OUTPUT = 'dist/beauty-admin/browser';

function sentryCli(...args) {
  const { status, error } = spawnSync(SentryCli.getPath(), args, { stdio: 'inherit' });
  if (error) {
    console.error(error);
  }
  return status === 0;
}

function uploadSourceMaps() {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    console.log('SENTRY_AUTH_TOKEN is not set: source maps are not uploaded to Sentry.');
    return true;
  }
  return sentryCli('sourcemaps', 'inject', OUTPUT) && sentryCli('sourcemaps', 'upload', OUTPUT);
}

function deleteSourceMaps(directory) {
  let deleted = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      deleted += deleteSourceMaps(path);
    } else if (entry.name.endsWith('.map')) {
      rmSync(path);
      deleted += 1;
    }
  }
  return deleted;
}

const uploaded = uploadSourceMaps();
const deleted = deleteSourceMaps(OUTPUT);
console.log(`Deleted ${deleted} source map(s) from ${OUTPUT}.`);

if (!uploaded) {
  console.error('Uploading source maps to Sentry failed; the build is not fit to host.');
  process.exit(1);
}
