/**
 * company-context.ts — Loads CompanyContext at session start.
 *
 * Priority order:
 *   1. COMPANY_PROFILE_PATH env var → reads a JSON file
 *   2. Individual COMPANY_* env vars
 *   3. DEFAULT_COMPANY_CONTEXT (local dev fallback)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CompanyContext } from './persona';
import { logger } from '@shared/logger';

// ---------------------------------------------------------------------------
// Default — used when no env config is provided
// ---------------------------------------------------------------------------

export const DEFAULT_COMPANY_CONTEXT: CompanyContext = {
  name: 'Acme Corp',
  stage: 'Series B SaaS startup',
  domain: 'B2B DevOps tooling for enterprise engineering teams',
  teamSize: 40,
  currentPriorities: [
    'Ship v2 platform by end of Q3',
    'Reduce customer churn below 5%',
    'Grow enterprise ARR by 40% this year',
  ],
  recentDecisions: [
    'Migrated to microservices architecture in January',
    'Hired 3 senior backend engineers in June',
    'Signed 2-year AWS Enterprise contract in May',
  ],
  techStack: ['Node.js', 'TypeScript', 'PostgreSQL', 'AWS ECS', 'Redis', 'React'],
  meetingObjective: 'Evaluate new feature proposals and decide which to prioritise for v2',
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load the CompanyContext for this session.
 *
 * Checks COMPANY_PROFILE_PATH first (a JSON file path), then falls back
 * to individual env vars, then the local-dev default.
 */
export function loadCompanyContext(): CompanyContext {
  // 1. JSON file path
  const filePath = process.env.COMPANY_PROFILE_PATH;
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      try {
        const raw = fs.readFileSync(resolved, 'utf-8');
        const ctx = JSON.parse(raw) as CompanyContext;
        logger.info('[company] Loaded company context from file', { path: resolved, name: ctx.name });
        return ctx;
      } catch (err) {
        logger.warn('[company] Failed to parse company profile JSON; using env/default', { error: String(err) });
      }
    } else {
      logger.warn('[company] COMPANY_PROFILE_PATH set but file not found', { path: resolved });
    }
  }

  // 2. Individual env vars
  const fromEnv = buildFromEnv();
  if (fromEnv) {
    logger.info('[company] Loaded company context from env vars', { name: fromEnv.name });
    return fromEnv;
  }

  // 3. Default
  logger.info('[company] Using default company context (local dev)', { name: DEFAULT_COMPANY_CONTEXT.name });
  return DEFAULT_COMPANY_CONTEXT;
}

function buildFromEnv(): CompanyContext | null {
  const name = process.env.COMPANY_NAME;
  if (!name) return null;

  return {
    name,
    stage: process.env.COMPANY_STAGE ?? 'Unknown stage',
    domain: process.env.COMPANY_DOMAIN ?? 'Unknown domain',
    teamSize: parseInt(process.env.COMPANY_TEAM_SIZE ?? '0', 10),
    currentPriorities: splitEnvList(process.env.COMPANY_PRIORITIES),
    recentDecisions: splitEnvList(process.env.COMPANY_RECENT_DECISIONS),
    techStack: splitEnvList(process.env.COMPANY_TECH_STACK),
    meetingObjective: process.env.MEETING_OBJECTIVE ?? 'General discussion',
  };
}

function splitEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}
