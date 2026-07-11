import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Minimal zero-dependency `.env` loader (dotenv is not a dependency). Parses
 * `KEY=VALUE` lines and populates `process.env` for keys that are not already
 * set, so real values from the environment always win over the file. Silently
 * no-ops when the file is absent.
 */
export function loadEnv(path = resolve(process.cwd(), '.env')): void {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}
