import type { UIComponent, UIMessage, StakeholderView, AgentStatus } from '../types';
import { AGENT_META, AGENT_ORDER, agentColor } from '../agents';

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'idle',
  thinking: 'thinking…',
  speaking: 'speaking',
};

/**
 * Four agent cards (CTO / Product / Finance / Research) showing each agent's
 * live status (idle / thinking / speaking) with animated transitions and the
 * time since their last intervention. Consumes `{ kind: 'stakeholder' }`.
 * (PRD FR-1104.)
 */
export class StakeholderPanel implements UIComponent {
  readonly kinds = ['stakeholder'] as const;
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'stakeholder' || !this.root) return;
    this.updateCard(msg.stakeholder);
  }

  clear(): void {
    if (!this.root) return;
    this.root.innerHTML = `<div class="agent-grid">${AGENT_ORDER.map(
      (id) => this.cardHtml(id),
    ).join('')}</div>`;
    for (const id of AGENT_ORDER) {
      this.updateCard({ id, status: 'idle', lastInterventionAt: null });
    }
  }

  private cardHtml(id: (typeof AGENT_ORDER)[number]): string {
    return `
      <div class="agent-card" id="agent-${id}" style="--agent: ${agentColor(id)}">
        <div class="agent-name">${AGENT_META[id].name}</div>
        <div class="agent-status" id="agent-${id}-status">idle</div>
        <div class="agent-last" id="agent-${id}-last"></div>
      </div>`;
  }

  private updateCard(s: StakeholderView): void {
    if (!this.root) return;
    const card = this.root.querySelector<HTMLElement>(`#agent-${s.id}`);
    const status = this.root.querySelector<HTMLElement>(`#agent-${s.id}-status`);
    const last = this.root.querySelector<HTMLElement>(`#agent-${s.id}-last`);
    if (!card || !status || !last) return;

    card.dataset.status = s.status;
    status.textContent = STATUS_LABEL[s.status];
    last.textContent = s.lastInterventionAt ? 'spoke recently' : '';
  }
}
