import type { ClientMessage } from './types';
import { Mic } from './mic';

export interface InputBarOptions {
  /** Sends an utterance to the backend; returns false when only the mock feed is live. */
  send: (message: ClientMessage) => boolean;
}

/** A scripted demo the "Play demo" button replays through the live pipeline. */
const DEMO_LINES: ReadonlyArray<{ speaker: string; text: string }> = [
  { speaker: 'Priya', text: 'I think we should migrate our platform to Kubernetes this quarter.' },
  { speaker: 'Arjun', text: 'Agreed. Traffic will probably stay under ten thousand users anyway.' },
  { speaker: 'Priya', text: 'Kubernetes gives us better scaling and safer rolling deploys.' },
  { speaker: 'Arjun', text: 'But operating Kubernetes adds real complexity and on-call burden.' },
  {
    speaker: 'Priya',
    text: 'What is the budget impact if the migration runs longer than planned?',
  },
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
    DEMO_LINES.forEach((line, index) => {
      window.setTimeout(() => {
        this.opts.send({ kind: 'say', speaker: line.speaker, text: line.text });
      }, index * 2500);
    });
  }
}
