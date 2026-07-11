# Conclave

A Cognitive Operating System for real-time technical decision making. Built for the Google DeepMind Bangalore Hackathon.

Conclave simulates a meeting between AI stakeholder agents (CTO, Product, Finance, Research) that listen to live audio, reason over structured context, and produce grounded interventions — like a panel of experts sitting in on your meeting.

## Architecture

```
Gemini Live API → Perception → Semantic Compressor → Event Bus
                                                         ↓
              Context Engine ← ← ← ← ← ← ← ← ← ← ← ←
                     ↓
           Cognitive Kernel → Stakeholder Agents → Speech Output → UI
                         ↑
                    Blackboard (shared memory)
```

| Layer | Module | Purpose |
|-------|--------|---------|
| **Input** | `src/perception/` | Gemini Live API for real-time audio, transcript processing, semantic compression |
| **Reasoning** | `src/context/`, `src/knowledge/` | Context tracking, decision graphs, knowledge graph |
| **Agents** | `src/agents/` | CTO, Product, Finance, Research — each with domain-specific prompts |
| **Orchestration** | `src/kernel/` | Cognitive kernel, attention budget, intervention scoring, blackboard |
| **Output** | `src/output/` | Response formatting (markdown + SSML), speech synthesis |
| **Shared** | `src/shared/` | Types, constants, utilities, logger |
| **UI** | `src/ui/` | Mock feed for visualization |

## Quick Start

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([get one free](https://aistudio.google.com/apikey))

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd conclave

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key-here

# Optional (defaults shown)
GEMINI_MODEL=gemini-3.5-flash
GEMINI_LIVE_MODEL=gemini-live-2.5-flash-preview
GEMINI_SEARCH_MODEL=gemini-3.5-flash
PORT=3000
WS_PORT=3001
```

### Run

```bash
# Start the server
npm run dev

# Start the UI (Vite dev server)
npm run dev:ui

# Run all tests
npm test

# Type-check
npm run typecheck

# Lint
npm run lint
```

## Stakeholder Agents

Each agent specializes in a domain and reasons over the same structured context:

| Agent | Domain | Concerns |
|-------|--------|----------|
| **CTO** | Technical architecture | Scalability, tech debt, security, infrastructure, API design |
| **Product** | User value | MVP scope, prioritization, customer impact, UX, roadmap |
| **Finance** | Cost & ROI | Infrastructure costs, operational expense, monetization, risk |
| **Research** | Evidence & validation | Missing data, unsupported assumptions, benchmarks, gaps |

Agents use **dependency injection** — they depend on `ILlmClient`, not on any specific LLM provider. Swap `GeminiLlmClient` for any other provider without changing agent code.

## How It Works

1. **Perception** captures audio via Gemini Live API and compresses it into structured semantic units (topics, decisions, assumptions, risks)
2. **Context Engine** maintains a rolling context snapshot and decision graph
3. **Cognitive Kernel** decides whether any agent should intervene, based on attention budget and cooldown
4. **Agents** evaluate the context, produce proposals (or null if irrelevant), and generate spoken responses
5. **Intervention Scorer** ranks proposals by novelty, urgency, and confidence
6. **Speech Output** converts responses to text and SSML for TTS

## Testing

```bash
# Run all tests (236+ tests)
npm test

# Run specific test suites
npx vitest run tests/unit/agents/
npx vitest run tests/integration/

# Run with real Gemini API (requires valid API key in .env)
npx vitest run tests/integration/real-gemini.test.ts
```

### Test Structure

```
tests/
├── unit/
│   ├── agents/        # BaseAgent, each stakeholder, registry, scorer
│   ├── output/        # ResponseFormatter
│   ├── kernel/        # Attention budget, arbitrator, blackboard
│   ├── context/       # Context engine, trackers
│   ├── perception/    # Semantic compressor, transcript processor
│   ├── knowledge/     # Knowledge graph
│   ├── shared/        # Similarity utils
│   └── ui/            # Mock feed
└── integration/
    ├── cognitive-tick.test.ts    # End-to-end pipeline
    ├── devc-smoke.test.ts        # Agents + output smoke test
    └── real-gemini.test.ts       # Live API integration
```

## Project Structure

```
src/
├── agents/
│   ├── base-agent.ts            # Abstract base — DI, pipeline, hooks
│   ├── interfaces.ts            # ILlmClient, IStakeholderAgent
│   ├── cto-agent.ts             # CTO stakeholder
│   ├── product-agent.ts         # Product stakeholder
│   ├── finance-agent.ts         # Finance stakeholder
│   ├── research-agent.ts        # Research stakeholder
│   ├── agent-registry.ts        # Agent lifecycle container
│   ├── intervention-scorer.ts   # Proposal scoring
│   └── gemini-llm-client.ts     # Gemini API wrapper
├── output/
│   ├── interfaces.ts            # ISpeechOutput, ITtsProvider
│   ├── response-formatter.ts    # Proposal → markdown + SSML
│   ├── speech-synthesizer.ts    # Queue-based speech pipeline
│   └── web-speech-provider.ts   # Browser TTS (only browser-touching code)
├── shared/
│   ├── types.ts                 # All shared DTOs
│   ├── constants.ts             # Runtime thresholds
│   ├── utils.ts                 # clamp(), extractJson()
│   ├── logger.ts                # Structured JSON logger
│   └── ...
├── perception/                  # Audio input + compression
├── context/                     # Context tracking
├── kernel/                      # Orchestration
├── knowledge/                   # Knowledge graph
├── events/                      # Event bus
└── ui/                          # Visualization
```

## Tech Stack

- **Runtime:** Node.js + TypeScript (CommonJS)
- **LLM:** Google Gemini 3.5 Flash (`@google/generative-ai`)
- **Live Audio:** Gemini Live API (`@google/genai`)
- **Testing:** Vitest
- **Linting:** ESLint with TypeScript rules
- **UI:** Vite

## License

Hackathon project — Google DeepMind Bangalore 2026.
