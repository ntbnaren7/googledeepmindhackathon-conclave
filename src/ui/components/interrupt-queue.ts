import type { UIComponent, UIMessage, InterventionView, InterventionState } from '../types';
import { AGENT_META, agentColor, escapeHtml } from '../agents';

const STATE_ICON: Record<InterventionState, string> = {
  granted: '✅',
  rejected: '❌',
  deferred: '⏸',
  pending: '…',
};

/**
 * The Intervention Log: pending / granted / rejected / deferred proposals, newest
 * first, colored by the agent that raised them and showing urgency and the
 * agent's recommendation text (its "spoken" intervention). Consumes
 * `{ kind: 'intervention' }`. (PRD FR-1107.)
 */
export class InterruptQueue implements UIComponent {
  readonly kinds = ['intervention'] as const;
  private root: HTMLElement | null = null;
  private readonly byId = new Map<string, HTMLElement>();

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'intervention' || !this.root) return;

    const empty = this.root.querySelector('.panel-empty');
    if (empty) empty.remove();

    const node = this.renderIntervention(msg.intervention);
    const existing = this.byId.get(msg.intervention.id);
    if (existing) {
      existing.replaceWith(node);
    } else {
      this.root.prepend(node); // newest first
    }
    this.byId.set(msg.intervention.id, node);
  }

  clear(): void {
    this.byId.clear();
    if (this.root) {
      this.root.innerHTML = '<p class="panel-empty">No interventions yet.</p>';
    }
  }

  private renderIntervention(i: InterventionView): HTMLElement {
    const el = document.createElement('div');
    el.className = `intervention enter state-${i.state}`;
    el.style.setProperty('--agent', agentColor(i.agent));
    el.innerHTML = `
      <div class="iv-head">
        <span class="iv-icon">${STATE_ICON[i.state]}</span>
        <span class="iv-agent" style="color:${agentColor(i.agent)}">${AGENT_META[i.agent].name}</span>
        <span class="iv-state">${i.state}</span>
        <span class="iv-urgency">urgency ${i.urgency.toFixed(2)}</span>
      </div>
      ${i.note ? `<div class="iv-note">${escapeHtml(i.note)}</div>` : ''}`;
    return el;
  }
}
