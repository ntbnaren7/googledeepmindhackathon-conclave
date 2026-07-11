import type { UIComponent, UIMessage, DecisionView } from '../types';
import { AGENT_META, agentColor, escapeHtml } from '../agents';

/**
 * Renders the Decision Graph: each decision node with its supporting (✓) and
 * opposing (✗) arguments, arguments attributed to the agent that raised them.
 * Decisions update in place by id as new arguments arrive.
 * Consumes `{ kind: 'decision' }`. (PRD FR-1105.)
 */
export class DecisionGraphPanel implements UIComponent {
  readonly kinds = ['decision'] as const;
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'decision' || !this.root) return;

    const empty = this.root.querySelector('.panel-empty');
    if (empty) empty.remove();

    const existing = this.root.querySelector<HTMLElement>(
      `[data-decision="${CSS.escape(msg.decision.id)}"]`,
    );
    const node = this.renderDecision(msg.decision);
    if (existing) existing.replaceWith(node);
    else this.root.appendChild(node);
  }

  clear(): void {
    if (this.root) {
      this.root.innerHTML = '<p class="panel-empty">No decisions yet.</p>';
    }
  }

  private renderDecision(d: DecisionView): HTMLElement {
    const el = document.createElement('div');
    el.className = 'decision-node enter';
    el.dataset.decision = d.id;

    const args = d.arguments
      .map((a) => {
        const marker = a.kind === 'support' ? '✓' : '✗';
        const cls = a.kind === 'support' ? 'arg-support' : 'arg-oppose';
        const who = a.agent
          ? `<span class="arg-agent" style="color:${agentColor(a.agent)}">${AGENT_META[a.agent].name}</span>`
          : '';
        return `<li class="${cls}"><span class="arg-mark">${marker}</span> ${escapeHtml(a.text)} ${who}</li>`;
      })
      .join('');

    el.innerHTML = `
      <div class="decision-title">◉ ${escapeHtml(d.label)}</div>
      <ul class="decision-args">${args}</ul>`;
    return el;
  }
}
