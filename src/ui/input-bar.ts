import type { ClientMessage } from './types';
import { Mic } from './mic';

export interface InputBarOptions {
  /** Sends an utterance to the backend; returns false when only the mock feed is live. */
  send: (message: ClientMessage) => boolean;
}

/**
 * Rich demo script that deliberately touches every agent's domain so all four
 * AI stakeholders (CTO, Product, Finance, Research) have something to say.
 *
 * Lines are spaced 8 seconds apart to give Gemini time to evaluate and the
 * browser TTS time to finish reading before the next line arrives.
 */
const DEMO_LINES: ReadonlyArray<{ speaker: string; text: string; delayMs: number }> = [
  // ── Opening: frame the decision ──────────────────────────────────────────
  { speaker: 'Priya', delayMs: 0,
    text: "Alright everyone, today we're deciding whether to rewrite our monolith into microservices this quarter or continue iterating on the existing Rails app." },

  { speaker: 'Arjun', delayMs: 9000,
    text: "The monolith is getting harder to deploy. Last sprint we had three rollbacks because unrelated services shared the same database schema." },

  { speaker: 'Priya', delayMs: 18000,
    text: "The proposed architecture uses an API gateway, separate services for auth, orders, and inventory, all communicating over Kafka with the Saga pattern for distributed transactions." },

  // ── Security & infrastructure angle (triggers CTO) ───────────────────────
  { speaker: 'Arjun', delayMs: 28000,
    text: "We also need to consider PCI-DSS compliance. Currently card data flows through our monolith. With microservices we could delegate tokenization to Stripe and shrink our compliance surface significantly." },

  { speaker: 'Priya', delayMs: 38000,
    text: "Agreed. But I'm worried about the operational complexity. We'd need Kubernetes, a service mesh, distributed tracing, and a proper on-call runbook before we go live." },

  // ── Cost & budget angle (triggers Finance) ────────────────────────────────
  { speaker: 'Ravi', delayMs: 50000,
    text: "What's the budget picture? Engineering says the migration will take three months minimum. That's nine engineers fully allocated. At our burn rate that's roughly four hundred thousand dollars in salaries alone before we see a single production deployment." },

  { speaker: 'Priya', delayMs: 60000,
    text: "And if we overshoot the timeline, which is common with microservices migrations, we're looking at opportunity cost on top of that. We'd delay our Q3 mobile feature launch by at least six weeks." },

  // ── Product & user impact angle (triggers Product) ────────────────────────
  { speaker: 'Meena', delayMs: 72000,
    text: "From a product perspective, the mobile launch is a bigger priority. Our NPS dropped from sixty-two to fifty-four this quarter and users are specifically citing slow checkout as the top pain point. The monolith refactor might fix the root cause faster." },

  { speaker: 'Arjun', delayMs: 82000,
    text: "We could do a targeted refactor of just the checkout and inventory modules without going full microservices. Strangler-fig pattern. Migrate incrementally over six months with zero downtime risk." },

  // ── Research & data angle (triggers Research) ─────────────────────────────
  { speaker: 'Ravi', delayMs: 93000,
    text: "Do we have data on how our traffic actually scales? The assumption has been that we'll need microservices for scale, but I haven't seen actual load projections. What does our peak traffic look like and what's the forecast for next year?" },

  { speaker: 'Meena', delayMs: 103000,
    text: "Based on last year's Black Friday data, our peak was twelve thousand concurrent users. The Rails monolith handled it with some latency spikes but no downtime. The question is whether we'll hit a hundred thousand next year." },

  // ── Decision moment ───────────────────────────────────────────────────────
  { speaker: 'Priya', delayMs: 115000,
    text: "So we're weighing: full microservices migration with higher risk, cost, and complexity versus a strangler-fig refactor that's slower but safer. Either way we need to decide today because engineering needs clarity to plan Q3." },

  { speaker: 'Arjun', delayMs: 125000,
    text: "I propose we go with the strangler-fig approach. We extract checkout and inventory as independent services this quarter, validate the pattern, then decide on full migration based on real production data." },

  { speaker: 'Meena', delayMs: 135000,
    text: "That lets us ship the mobile features in parallel. I can have the product team define the API contracts for checkout by end of week so engineering can start the extraction." },

  { speaker: 'Ravi', delayMs: 145000,
    text: "If we do the strangler-fig, can we get a cost estimate? I need to justify the additional cloud infrastructure spend to the board. We're talking about running both the monolith and the new services in parallel during the transition." },

  { speaker: 'Priya', delayMs: 155000,
    text: "Let's assume it's decided: we go strangler-fig for Q3. Arjun owns the technical architecture. Meena owns the API contracts. Ravi owns the infrastructure cost model. Next milestone is a design review in two weeks. Any blockers?" },
];


/**
 * The meeting input bar: choose a speaker, then drive the live pipeline by
 * typing an utterance, speaking via the browser mic, or replaying a demo. Each
 * utterance is sent to the backend as a `say` message.
 */
export class InputBar {
  private readonly mic: Mic;
  private speakerInput!: HTMLInputElement;
  private textInput!: HTMLInputElement;
  private micButton!: HTMLButtonElement;
  private hint!: HTMLElement;

  constructor(private readonly opts: InputBarOptions) {
    this.mic = new Mic(
      (text) => this.emit(text),
      (listening) => this.micButton.classList.toggle('active', listening),
    );
  }

  mount(root: HTMLElement): void {
    root.innerHTML = `
      <input id="ib-speaker" class="ib-speaker" type="text" value="Priya" aria-label="Speaker name" />
      <input id="ib-text" class="ib-text" type="text"
             placeholder="Type what someone says, then press Enter…" aria-label="Utterance" />
      <button id="ib-send" class="ib-btn" type="button">Send</button>
      <button id="ib-mic" class="ib-btn ib-mic" type="button" title="Speak (browser mic)">🎤</button>
      <button id="ib-demo" class="ib-btn" type="button">Play demo</button>
      <span id="ib-hint" class="ib-hint"></span>
    `;

    this.speakerInput = root.querySelector('#ib-speaker') as HTMLInputElement;
    this.textInput = root.querySelector('#ib-text') as HTMLInputElement;
    this.micButton = root.querySelector('#ib-mic') as HTMLButtonElement;
    this.hint = root.querySelector('#ib-hint') as HTMLElement;

    (root.querySelector('#ib-send') as HTMLButtonElement).addEventListener('click', () =>
      this.sendTyped(),
    );
    this.textInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.sendTyped();
    });

    if (Mic.isSupported()) {
      this.micButton.addEventListener('click', () => this.mic.toggle());
    } else {
      this.micButton.disabled = true;
      this.micButton.title = 'Speech recognition is not available in this browser';
    }

    (root.querySelector('#ib-demo') as HTMLButtonElement).addEventListener('click', () =>
      this.playDemo(),
    );
  }

  private sendTyped(): void {
    const text = this.textInput.value.trim();
    if (text === '') return;
    if (this.emit(text)) this.textInput.value = '';
  }

  private emit(text: string): boolean {
    const speaker = this.speakerInput.value.trim() || 'Speaker';
    const ok = this.opts.send({ kind: 'say', speaker, text });
    this.hint.textContent = ok ? '' : 'Not connected to the live backend (mock feed).';
    return ok;
  }

  private playDemo(): void {
    DEMO_LINES.forEach((line) => {
      window.setTimeout(() => {
        this.opts.send({ kind: 'say', speaker: line.speaker, text: line.text });
      }, line.delayMs);
    });
  }
}
