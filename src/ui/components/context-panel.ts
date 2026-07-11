import type { UIComponent, UIMessage, ContextView } from '../types';
import { escapeHtml } from '../agents';

/**
 * Shows the current meeting context: topic, active assumptions, decisions, and
 * open risks. Replaced wholesale on each update. Consumes `{ kind: 'context' }`.
 * (PRD FR-1106.)
 *
 * Note: not in the default 4-quadrant layout; registered when a `context-body`
 * mount exists (optional panel).
 */
export class ContextPanel implements UIComponent {
  readonly kinds = ['context'] as const;
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'context' || !this.root) return;
    this.root.innerHTML = this.render(msg.context);
  }

  clear(): void {
    if (this.root) {
      this.root.innerHTML = '<p class="panel-empty">No context yet.</p>';
    }
  }

  private render(c: ContextView): string {
    return `
      <div class="ctx-topic">Topic: <strong>${escapeHtml(c.topic)}</strong></div>
      ${this.section('Assumptions', c.assumptions)}
      ${this.section('Decisions', c.decisions)}
      ${this.section('Risks', c.risks)}`;
  }

  private section(title: string, items: string[]): string {
    if (items.length === 0) return '';
    const lis = items.map((i) => `<li>${escapeHtml(i)}</li>`).join('');
    return `<div class="ctx-section"><h3>${title}</h3><ul>${lis}</ul></div>`;
  }
}
