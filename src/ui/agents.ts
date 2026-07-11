import type { AgentId } from './types';

/** Display metadata for each stakeholder agent (name + CSS color variable). */
export const AGENT_META: Record<AgentId, { name: string; short: string; colorVar: string }> = {
  cto: { name: 'CTO', short: 'CTO', colorVar: '--agent-cto' },
  product: { name: 'Product', short: 'PROD', colorVar: '--agent-product' },
  finance: { name: 'Finance', short: 'FIN', colorVar: '--agent-finance' },
  research: { name: 'Research', short: 'RES', colorVar: '--agent-research' },
};

export const AGENT_ORDER: AgentId[] = ['cto', 'product', 'finance', 'research'];

/** Returns the CSS color for an agent (or the accent color for 'system'). */
export function agentColor(agent: AgentId | 'system'): string {
  if (agent === 'system') return 'var(--accent)';
  return `var(${AGENT_META[agent].colorVar})`;
}

/** Escapes text for safe insertion into innerHTML. */
export function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** A palette for human transcript speakers, indexed by speakerIndex. */
export const SPEAKER_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#22d3ee',
];

export function speakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
