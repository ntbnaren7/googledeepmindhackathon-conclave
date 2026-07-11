import type { UIComponent, UIMessage, BudgetView } from '../types';

const EMPTY: BudgetView = { percent: 100, interruptions: 0, threshold: 0.4, cooldownMs: 0 };

/**
 * The visual centerpiece: a large horizontal gauge showing remaining attention
 * budget. The fill animates on change and shifts colour green → yellow → red as
 * the budget depletes. Also shows interruption count, current threshold, and a
 * cooldown badge. Consumes `{ kind: 'budget' }`. (PRD FR-1102.)
 */
export class AttentionBudgetGauge implements UIComponent {
  readonly kinds = ['budget'] as const;
  private root: HTMLElement | null = null;
  private fill: HTMLElement | null = null;
  private percentEl: HTMLElement | null = null;
  private metaEl: HTMLElement | null = null;
  private cooldownEl: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <div class="gauge">
        <div class="gauge-top">
          <span class="gauge-percent" id="g-pct">100%</span>
          <span class="gauge-cooldown" id="g-cool" hidden>COOLDOWN</span>
        </div>
        <div class="gauge-track"><div class="gauge-fill" id="g-fill"></div></div>
        <div class="gauge-meta" id="g-meta">Interruptions: 0 · Threshold: 0.40</div>
      </div>`;
    this.root = root;
    this.fill = root.querySelector('#g-fill');
    this.percentEl = root.querySelector('#g-pct');
    this.metaEl = root.querySelector('#g-meta');
    this.cooldownEl = root.querySelector('#g-cool');
    this.render(EMPTY);
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'budget') return;
    this.render(msg.budget);
  }

  clear(): void {
    this.render(EMPTY);
  }

  private render(b: BudgetView): void {
    const pct = Math.max(0, Math.min(100, b.percent));
    if (this.fill) {
      this.fill.style.width = `${pct}%`;
      this.fill.style.background = this.gradientFor(pct);
    }
    if (this.percentEl) this.percentEl.textContent = `${Math.round(pct)}%`;
    if (this.metaEl) {
      this.metaEl.textContent = `Interruptions: ${b.interruptions} · Threshold: ${b.threshold.toFixed(2)}`;
    }
    if (this.cooldownEl) this.cooldownEl.hidden = b.cooldownMs <= 0;
    if (this.root) this.root.classList.toggle('is-low', pct <= 25);
  }

  private gradientFor(pct: number): string {
    if (pct <= 25) return 'linear-gradient(90deg, var(--budget-low), #f87171)';
    if (pct <= 55) return 'linear-gradient(90deg, var(--budget-mid), #fbbf24)';
    return 'linear-gradient(90deg, var(--budget-high), #34d399)';
  }
}
