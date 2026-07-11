import type { UIComponent, UIMessage, TranscriptLineView } from '../types';
import { escapeHtml, speakerColor } from '../agents';

/**
 * The live transcript of the HUMAN discussion. Lines are color-coded per speaker
 * (by speakerIndex), slide in from the bottom, and auto-scroll. Agent speech is
 * intentionally NOT shown here — agent interventions appear in the Intervention
 * Log and Stakeholder panel. Consumes `{ kind: 'transcript' }`. (PRD FR-1101.)
 */
export class TranscriptPanel implements UIComponent {
  readonly kinds = ['transcript'] as const;
  private root: HTMLElement | null = null;
  private readonly seen = new Set<string>();

  mount(root: HTMLElement): void {
    this.root = root;
    this.clear();
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'transcript' || !this.root) return;
    if (this.seen.has(msg.line.id)) return;
    this.seen.add(msg.line.id);

    const empty = this.root.querySelector('.panel-empty');
    if (empty) empty.remove();

    this.root.appendChild(this.renderLine(msg.line));
    this.root.scrollTop = this.root.scrollHeight;
  }

  clear(): void {
    this.seen.clear();
    if (this.root) {
      this.root.innerHTML = '<p class="panel-empty">Waiting for discussion…</p>';
    }
  }

  private renderLine(line: TranscriptLineView): HTMLElement {
    const el = document.createElement('div');
    el.className = 'transcript-line enter';
    el.innerHTML = `
      <span class="ts-speaker" style="color:${speakerColor(line.speakerIndex)}">${escapeHtml(line.speaker)}</span>
      <span class="ts-text">${escapeHtml(line.text)}</span>`;
    return el;
  }
}
