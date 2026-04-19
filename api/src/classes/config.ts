// node_modules
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// -------------------------------------------------- Config --------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Compiled to build/classes/config.js:
// - Docker runtime: __dirname = /app/build/classes → ../../dashboard/dist = /app/dashboard/dist
// - Monorepo local: __dirname = …/api/build/classes → ../../../dashboard/dist = repo sibling dashboard/dist
function resolveDashboardDistPath(): string {
  const fromEnv = process.env['DASHBOARD_DIST_PATH']?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const dockerLayout = join(__dirname, '..', '..', 'dashboard', 'dist');
  const monorepoLayout = join(__dirname, '..', '..', '..', 'dashboard', 'dist');
  if (existsSync(dockerLayout)) {
    return dockerLayout;
  }
  if (existsSync(monorepoLayout)) {
    return monorepoLayout;
  }
  return dockerLayout;
}

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  jwtSecret: requireEnv('JWT_SECRET'),
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isProduction: process.env['NODE_ENV'] === 'production',
  dashboardDistPath: resolveDashboardDistPath(),
  configDir: process.env['CONFIG_DIR']?.trim() || join(homedir(), '.nova-task'),
};
