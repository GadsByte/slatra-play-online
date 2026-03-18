#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const configuredCommand = process.env.PRODUCTION_DEPLOY_COMMAND?.trim();

if (!configuredCommand) {
  console.error('[deploy] PRODUCTION_DEPLOY_COMMAND is required to run the production deploy.');
  console.error('[deploy] Verification already passed, but deployment is intentionally blocked until the real deploy command is configured.');
  process.exit(1);
}

const result = spawnSync(configuredCommand, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
