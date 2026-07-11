# Dev B — Context Track: Broad Development TODO

> **Owner:** Dev B (**Context**)
> **Branch:** `feature/context` (Context Engine + Knowledge Graph), `feature/compressor` (Semantic Compressor)
> **Primary ownership:** Context Engine, Knowledge Graph, Semantic Compressor
> **Secondary ownership:** Decision Graph generation, Meeting Record export
> **Source of truth:** [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) · [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) · [`PRD.md`](./PRD.md)

This is the **broad, phase-by-phase plan** for what Dev B builds and in what order. It is intentionally
high-level — each checkbox is a unit of work, not a line of code. Detailed data shapes live in the
Implementation Plan (Phase 2 + Phase 5b). Check items off as they land.

---

## 0. Mental model — what Dev B is responsible for

Dev B owns the **memory / world model** of the system. Everything else reads from it.

```
transcript text ──▶ [Semantic Compressor] ──▶ SemanticDelta (SemanticUnit[])
                                                     │
                              delta.produced event   ▼
                                            [Context Engine]
                             ┌───────────────┼───────────────┐
                        TopicTracker   DecisionTracker   Assumption/RiskTracker
                             └───────────────┼───────────────┘
                                       [Context Store]  ──▶ [Context Projector] ──▶ frozen ContextSnapshot
                                             │
                                     [Knowledge Graph]  ──▶ Decision Graph + Meeting Record export
```

**Three deliverables, in dependency order:**
1. **Context Engine** (`src/context/`) — ingest `SemanticDelta`, maintain state, project frozen `ContextSnapshot`.
2. **Knowledge Graph** (`src/knowledge/`) — flat store of everything said, source for Decision Graph + export.
3. **Semantic Compressor** (`src/perception/semantic-compressor.ts`) — Gemini structured output: raw text → `SemanticDelta`.

---

## ⚠️ Blocking dependency (do this check first)

Dev B depends on **Dev A's foundation types** being defined before real work starts:

- [ ] Confirm `src/shared/types.ts` defines `SemanticDelta`, `SemanticUnit`, `ContextSnapshot`, `ContextState`, `DecisionNode`, `KnowledgeEntry` (currently only `Speaker` exists — **these are still missing**).
- [ ] Confirm `src/events/event-types.ts` / `event-schema.ts` define `delta.produced`, `context.updated`, `topic.changed`, `agent.finished`.
- [ ] Sign off on the **Interface Contract (M0)** with Dev A before coding trackers.

> Until these land, Dev B works against **agreed interface shapes** and can build skeletons/stubs that compile.
> The current `src/context/*` and `src/knowledge/*` files are stubs (`return {}` / `TODO`) — they are the starting point, not finished work.

---

## Phase 0 — Interface Contract (M0) · owns `src/context/interfaces.ts`, `src/knowledge/interfaces.ts`

**Goal:** Lock the contracts so Dev A (Kernel) and Dev D (UI) can code against Dev B in parallel.

- [ ] Define `IContextEngine` — `initialize`, `handleDelta`, `getSnapshot`, `getDecisionGraph`, `reset`.
- [ ] Define `IContextStore` (typed get/update) and `IContextProjector` (`project(state) → frozen snapshot`).
- [ ] Define `IKnowledgeGraph` — `store`, `getAll`, `getByType`, `getDecisionNodes`, `export`.
- [ ] Replace `any` in the current stub interfaces with the real foundation types once Dev A ships them.
- [ ] **Gate:** `npx tsc --noEmit` passes with the interface stubs. Dev A + Dev D review and sign off.

---

## Phase 1 — Context Engine (M2) · `src/context/` — the main build

**Goal:** `contextEngine.handleDelta(mockDelta)` → `contextEngine.getSnapshot()` returns a populated, **frozen** snapshot.

### 1a. State + projection
- [ ] `context-store.ts` — in-memory `ContextState` with typed get/update methods (topic, decisions, assumptions, risks, interventions).
- [ ] `context-projector.ts` — deep-clone `ContextState` → **frozen** `ContextSnapshot` with unique id + timestamp. (Mutating the clone must NOT touch the store.)

### 1b. Trackers (one concern each)
- [ ] `topic-tracker.ts` — current topic, topic-change detection, topic history.
- [ ] `decision-tracker.ts` — decisions with supporting/opposing arguments + status transitions; produces `DecisionNode[]`.
- [ ] `assumption-tracker.ts` — assumptions with status: `active → challenged → validated → invalidated`.
- [ ] `risk-tracker.ts` — risks with severity + mitigation status.

### 1c. Orchestration
- [ ] `context-engine.ts` — route each `SemanticUnit` by `type` to the correct tracker; subscribe to `delta.produced` / `topic.changed` / `agent.finished`; emit `context.updated` on any change; expose Decision Graph via `getDecisionGraph()`.
- [ ] `index.ts` — barrel export.

### 1d. Tests (`tests/unit/context/`)
- [ ] Engine: proposal→decision, assumption→assumption, risk→risk, topic change→topic+history, emits `context.updated`.
- [ ] Projector: snapshot deeply frozen; unique id + timestamp; mutation isolation.
- [ ] Decision tracker: records status, adds supporting/opposing args, produces `DecisionNode[]`.

**Gate (M2):** all Phase 1 unit tests green; snapshot is frozen; `tsc` clean.

---

## Phase 2 — Knowledge Graph (M2) · `src/knowledge/`

**Goal:** flat, append-only record of everything, and the source for Decision Graph + Meeting Record.

- [ ] `knowledge-graph.ts` — `store(entry)` appends + returns id; `getByType(type)` filters; `getDecisionNodes()`; `export()` → meeting record.
- [ ] `index.ts` — barrel export.
- [ ] Tests (`tests/unit/knowledge/`): stores entries, retrieves by type, produces decision nodes, exports meeting record.

**Gate:** Knowledge Graph unit tests green.

---

## Phase 3 — Semantic Compressor (M5b) · `src/perception/semantic-compressor.ts`

> Lives in `src/perception/` but is **Dev B's** file (Gemini structured-output prompting = same skill as Context Engine).
> Build on `feature/compressor`. Dev D wires it into the Perception Engine.

**Goal:** raw transcript text → `SemanticDelta` with structured `SemanticUnit[]`.

- [ ] Implement `compress(segments)` — call Gemini with the structured-output prompt (see IMPLEMENTATION_PLAN §5.1), parse JSON into `{ units: SemanticUnit[], topicShift, newTopic }`.
- [ ] Map unit `type` enum: `proposal | decision | assumption | risk | question | objection | clarification | statement | agreement`; attach `confidence` (0–1) + `domain`.
- [ ] Error handling: malformed/failed Gemini response is caught, logged, and returns an empty-but-valid delta (never crashes the tick).
- [ ] Tests (`tests/unit/perception/semantic-compressor.test.ts`) with **mocked** Gemini responses.

**Gate (M5b):** `"We should use Kubernetes because our traffic will exceed 100k users"` → `[{type:"proposal",...},{type:"assumption",...}]`.

---

## Phase 4 — Decision Graph + Meeting Record export (Day 3 / secondary ownership)

**Goal:** turn accumulated state into the two user-facing artifacts.

- [ ] **Decision Graph generation** — `getDecisionGraph()` yields `DecisionNode[]` (decision + supporting/opposing arguments + status) shaped for the UI decision-graph panel.
- [ ] **Meeting Record export** — `KnowledgeGraph.export()` produces the full meeting record (topics, decisions, assumptions, risks, interventions) as structured JSON.
- [ ] Support Dev D's `context-panel` / `decision-graph-panel` with a stable snapshot shape (no UI code, just the data contract + any needed getters).
- [ ] Decision Graph visual-polish support pass (Day 3 timeline item).

---

## Integration checkpoints (shared, don't skip)

- [ ] **Checkpoint 3 — "Vertical Slices Connect":** real Context Engine + real Agent eval (mocked Gemini) run inside a full kernel tick without Dev B being the bottleneck.
- [ ] Provide a `mockDelta` / `mockSnapshot` fixture for Dev A + Dev C to test against early.
- [ ] End-to-end (Day 3): speak → transcript → **compress → context updates** → agents evaluate → UI reflects context changes.

---

## Definition of Done for Dev B

- [ ] `tsc --noEmit` clean across `src/context`, `src/knowledge`, `src/perception/semantic-compressor.ts`.
- [ ] All Dev B unit test files green (`tests/unit/context/`, `tests/unit/knowledge/`, `tests/unit/perception/semantic-compressor.test.ts`).
- [ ] Context Engine emits `context.updated`; snapshots are frozen deep clones.
- [ ] Semantic Compressor returns a valid `SemanticDelta` from real transcript text (mocked Gemini in tests).
- [ ] Decision Graph + Meeting Record export produce well-formed output consumed by the UI.
- [ ] All cross-module access goes **only** through `IContextEngine` / `IKnowledgeGraph`.

---

## Suggested build order (fastest path to a working slice)

1. Interfaces (Phase 0) → get sign-off.
2. `context-store` + `context-projector` (state + freezing) — unblocks the snapshot contract.
3. Trackers (topic → decision → assumption → risk).
4. `context-engine` wiring + `context.updated` emission → **M2 gate**.
5. Knowledge Graph + tests.
6. Semantic Compressor (Phase 3) → **M5b gate**.
7. Decision Graph + Meeting Record export (Phase 4).

## Risk fallbacks (from PRD risk table)

- If the context model gets too complex: ship **topic + decision + assumption only**; add Risk Tracker last if time permits.
- Keep Decision Graph + Meeting Record as the stretch layer — the tick must work without them.
