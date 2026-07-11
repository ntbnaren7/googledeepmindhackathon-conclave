import type { UIComponent, UIMessage, BlackboardEntryView, BlackboardEntryType } from '../types';
import { AGENT_META, agentColor, escapeHtml } from '../agents';

const TYPE_ICON: Record<BlackboardEntryType, string> = {
  observation: '●',
  warning: '⚠',
  hypothesis: '💡',
  question: '?',
  confidence_update: '📊',
  agreement: '✓',
  disagreement: '✗',
};

const TYPE_COLOR: Record<BlackboardEntryType, string> = {
  observation: 'var(--bb-observation)',
  warning: 'var(--bb-warning)',
  hypothesis: 'var(--bb-hypothesis)',
  question: 'var(--bb-question)',
  confidence_update: 'var(--bb-confidence)',
  agreement: 'var(--bb-agreement)',
  disagreement: 'var(--bb-disagreement)',
};

/**
 * Shows Cognitive Blackboard entries as agents post observations. Entries are
 * grouped by tick, color-coded by type, attributed to their agent, and animate
 * in. Convergence entries are highlighted. Consumes `{ kind: 'blackboard' }`.
 * (PRD FR-1103, FR-904.)
 */
export class BlackboardPanel implements UIComponent {
  readonly kinds = ['blackboard'] as const;
  private root: HTMLElement | null = null;
  private readonly seen = new Set<string>();

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'blackboard' || !this.root) return;
    if (this.seen.has(msg.entry.id)) return;
    this.seen.add(msg.entry.id);

    const empty = this.root.querySelector('.panel-empty');
    if (empty) empty.remove();

    this.root.appendChild(this.renderEntry(msg.entry));
    this.root.scrollTop = this.root.scrollHeight;
  }

  clear(): void {
    this.seen.clear();
    if (this.root) {
      this.root.innerHTML = '<p class="panel-empty">No observations yet.</p>';
    }
  }

  private renderEntry(e: BlackboardEntryView): HTMLElement {
    const agentName =
      e.agent === 'system' ? 'System' : AGENT_META[e.agent].name;
    const el = document.createElement('div');
    el.className = 'bb-entry enter' + (e.converging ? ' bb-converging' : '');
    el.style.setProperty('--bb-accent', TYPE_COLOR[e.type]);
    el.innerHTML = `
      <div class="bb-head">
        <span class="bb-icon">${TYPE_ICON[e.type]}</span>
        <span class="bb-agent" style="color:${agentColor(e.agent)}">${escapeHtml(agentName)}</span>
        <span class="bb-tick">tick ${e.tickId}</span>
        ${e.converging ? '<span class="bb-converge">CONVERGENCE</span>' : ''}
      </div>
      <div class="bb-content">${escapeHtml(e.content)}</div>`;
    return el;
  }
}
