# Conclave — Product Requirements Document

**Version:** 1.0
**Date:** July 11, 2026
**Status:** Approved for Implementation
**Target:** Google DeepMind Bangalore Hackathon

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Problem Statement](#2-problem-statement)
3. [Goals](#3-goals)
4. [Non-Goals](#4-non-goals)
5. [Target Users](#5-target-users)
6. [User Personas](#6-user-personas)
7. [Core Interaction Paradigm](#7-core-interaction-paradigm)
8. [Technical Differentiators](#8-technical-differentiators)
9. [System Overview](#9-system-overview)
10. [Functional Requirements](#10-functional-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Architecture Overview](#12-architecture-overview)
13. [Stakeholder Agents](#13-stakeholder-agents)
14. [Intervention Policy](#14-intervention-policy)
15. [Cognitive Kernel](#15-cognitive-kernel)
16. [Cognitive Blackboard](#16-cognitive-blackboard)
17. [UX Flows](#17-ux-flows)
18. [Success Metrics](#18-success-metrics)
19. [Assumptions](#19-assumptions)
20. [Risks](#20-risks)
21. [Constraints](#21-constraints)
22. [Future Roadmap](#22-future-roadmap)
23. [Demo Flow](#23-demo-flow)
24. [Google DeepMind Hackathon Alignment](#24-google-deepmind-hackathon-alignment)

---

## 1. Product Vision

**Conclave is a Cognitive Operating System that continuously observes technical discussions, compresses them into structured semantic state, runs autonomous stakeholder reasoning, arbitrates competing interventions based on expected information gain and human attention cost, and selectively injects expertise only when it measurably improves collective decision quality.**

Conclave is not a chatbot. It is not a meeting summarizer. It is not a collection of AI agents.

The fundamental innovation is a new human-AI interaction paradigm: instead of humans asking AI questions, humans conduct a normal technical discussion while autonomous AI stakeholders continuously observe, reason, collaborate indirectly through a Cognitive Blackboard, and decide whether interrupting the discussion would improve the quality of the decision.

The intelligence of the system is measured not by how well it answers questions, but by **how well it decides whether it should speak at all**.

---

## 2. Problem Statement

### The Current State

Technical decision-making in organizations suffers from structural blindspots:

- **Incomplete perspective coverage.** When a CTO and product lead discuss architecture, financial implications are often absent from the conversation. When finance reviews a budget, engineering feasibility is assumed rather than validated.
- **Cognitive overload.** Decision-makers cannot simultaneously track assumptions, risks, dependencies, and implications across every domain while actively engaging in discussion.
- **Information asymmetry.** Critical data (market research, cost projections, technical benchmarks) exists but is not surfaced at the moment of decision.
- **Post-hoc analysis.** Decisions are documented after they are made, not while they are forming. By the time someone realizes an assumption was flawed, the decision has already been committed.

### Why Existing Solutions Fail

| Solution | Failure Mode |
|---|---|
| Meeting transcription tools | Passive. Record what happened. Do not improve what happens. |
| AI assistants (ChatGPT, etc.) | Reactive. Must be asked. Cannot autonomously observe and intervene. |
| Multi-agent frameworks (CrewAI, AutoGen) | Task-oriented. Execute workflows. Do not observe and reason about human discussions in real-time. |
| Meeting summarizers | Post-hoc. Summarize after the damage is done. |

### The Gap

No system exists that:

1. Continuously observes a live human discussion
2. Compresses it into structured semantic state in real-time
3. Runs autonomous domain-expert reasoning against that state
4. Decides autonomously whether intervention would improve decision quality
5. Treats human attention as a finite resource to be conserved

Conclave fills this gap.

---

## 3. Goals

### Primary Goals

| ID | Goal | Measurable Outcome |
|---|---|---|
| G1 | Demonstrate a working Cognitive Operating System | End-to-end demo: human speaks → AI reasons → AI selectively intervenes |
| G2 | Prove the attention-as-scarce-resource thesis | Attention Budget visibly constrains AI behavior; AI becomes quieter over time |
| G3 | Show autonomous multi-stakeholder reasoning | 4 agents independently evaluate, post to Blackboard, produce proposals |
| G4 | Demonstrate the Cognitive Tick model | Observable, deterministic cognition cycle per semantic event |
| G5 | Show indirect agent collaboration via Blackboard | Agents build on each other's observations across ticks |
| G6 | Produce a Decision Graph (not minutes) | Structured graph of decisions → arguments → evidence → agents |

### Secondary Goals

| ID | Goal |
|---|---|
| G7 | Win the Google DeepMind Bangalore Hackathon |
| G8 | Demonstrate deep Gemini Live API integration |
| G9 | Create a reusable cognitive runtime framework |

---

## 4. Non-Goals

| ID | Non-Goal | Rationale |
|---|---|---|
| NG1 | Production deployment | Hackathon scope. In-memory state is acceptable. |
| NG2 | Multi-meeting persistent memory | Single meeting lifecycle is sufficient for demo. |
| NG3 | User authentication | Not relevant to the core innovation. |
| NG4 | Mobile support | Desktop demo is sufficient. |
| NG5 | Custom agent creation UI | Agents are configured in code. |
| NG6 | Real-time collaboration (multiple human viewers) | Single observer UI is sufficient. |
| NG7 | Fine-grained speaker diarization | Gemini Live provides basic diarization; we use it as-is. |
| NG8 | Persistent database | In-memory arrays and objects are sufficient. |
| NG9 | Agent personality or tone customization | Agents represent organizational incentives, not personalities. |

---

## 5. Target Users

### Primary User: The Discussion Participant

Technical leaders (CTOs, VPs of Engineering, Product Managers, Technical Architects) who make decisions in real-time discussions and want autonomous AI stakeholders to improve decision quality without disrupting flow.

### Secondary User: The Observer

Team members, investors, or auditors who want to observe AI-augmented decision-making in real-time, seeing what the AI is thinking, what it chose not to say, and how attention budget constrains behavior.

### Tertiary User: The Hackathon Judge

Google DeepMind engineers and researchers evaluating technical innovation, Gemini API usage depth, and systems-level thinking.

---

## 6. User Personas

### Persona 1: Priya — CTO at a Growth-Stage Startup

**Context:** Priya leads weekly architecture reviews with her product lead and engineering managers. Decisions are made fast, but she frequently discovers weeks later that cost implications or market data were not considered.

**Pain:** She cannot bring every stakeholder to every meeting. She needs an ambient intelligence that watches for blindspots.

**Conclave value:** Autonomous Finance and Research agents catch what Priya's team misses — in real-time, not post-mortem.

### Persona 2: Arjun — VP of Product

**Context:** Arjun frequently makes product decisions in ad-hoc Slack huddles or quick sync calls. These decisions are rarely documented until they're already committed.

**Pain:** Decision rationale is lost. Assumptions are never tracked. When things go wrong, nobody can trace why the decision was made.

**Conclave value:** Every decision is captured as a node in the Decision Graph with full evidential lineage: who said what, which agent objected, what the confidence was.

### Persona 3: Dr. Meera — DeepMind Hackathon Judge

**Context:** Meera has reviewed dozens of "multi-agent" hackathon submissions. Most are chatbots with roles.

**Expectation:** Systems-level innovation. Novel abstractions. Deep API usage. Not just "we gave GPT four different system prompts."

**Conclave value:** The Cognitive Tick, Semantic Compressor, Blackboard architecture, and Attention Budget are genuine systems innovations — not prompt engineering.

---

## 7. Core Interaction Paradigm

### Traditional AI Interaction

```
Human → asks question → AI → answers → Human
```

### Conclave Interaction

```
Human ←→ Human (normal discussion)
         ↑
    AI observes silently
         ↓
    AI compresses meaning
         ↓
    AI reasons autonomously
         ↓
    AI evaluates: "Should I speak?"
         ↓
    Usually: No. Continue listening.
    Rarely: Yes. Intervene with high-value insight.
```

The critical design principle: **silence is the default**. The system must earn the right to speak by clearing a high bar of expected information gain relative to the cost of interrupting human flow.

---

## 8. Technical Differentiators

| Differentiator | Description | Why It Matters |
|---|---|---|
| **Cognitive Tick** | Deterministic, CPU-like cognition cycle per semantic event | Makes AI cognition debuggable, replayable, and bounded. No runaway processing. |
| **Semantic Compressor** | Raw transcript → compressed semantic units before context ingestion | Agents reason over meaning, not words. 10x reduction in LLM token usage. |
| **Cognitive Blackboard** | Shared observation board for indirect agent collaboration | Agents build on each other's reasoning without coupling. Creates emergent consensus. |
| **Attention Budget** | Human attention modeled as a finite, depletable, replenishable resource | AI self-regulates. More interruptions → higher bar for future interruptions. Prevents AI noise. |
| **Intervention Arbitration** | Multiplicative urge formula with Blackboard convergence amplification | All factors must be meaningful. Zero in any dimension = zero urge. Convergence across agents amplifies signal. |
| **Decision Graph** | Structured decision → argument → evidence → agent lineage | Not minutes. A navigable graph of how decisions formed. |

---

## 9. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONCLAVE                                     │
│                   Cognitive Operating System                        │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────────┐    │
│  │ Gemini   │──▶│Perception│──▶│ Semantic Compressor          │    │
│  │ Live API │   │ Engine   │   │ (400 words → 3 semantic units)│    │
│  └──────────┘   └──────────┘   └──────────┬───────────────────┘    │
│                                            │                        │
│                                            ▼                        │
│                                   ┌────────────────┐                │
│                                   │ Event Bus      │                │
│                                   └───────┬────────┘                │
│                                           │                         │
│  ┌────────────────────────────────────────┼────────────────────┐    │
│  │              COGNITIVE KERNEL          │                    │    │
│  │  ┌─────────┐  ┌───────────┐  ┌───────▼──────┐            │    │
│  │  │Attention│  │ Arbitrator│  │Context Engine│            │    │
│  │  │ Budget  │  │           │  └──────────────┘            │    │
│  │  └─────────┘  └───────────┘  ┌──────────────┐            │    │
│  │  ┌─────────┐  ┌───────────┐  │  Cognitive   │            │    │
│  │  │Attention│  │ Proposal  │  │  Blackboard  │            │    │
│  │  │  Gate   │  │   Pool    │  └──────────────┘            │    │
│  │  └─────────┘  └───────────┘                               │    │
│  └───────────────────────┬───────────────────────────────────┘    │
│                          │                                         │
│            ┌─────────────┼─────────────┐                          │
│            ▼             ▼             ▼                          │
│      ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│      │  CTO    │  │ Product  │  │ Finance  │  │ Research │     │
│      │  Agent  │  │  Agent   │  │  Agent   │  │  Agent   │     │
│      └─────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                          │                                         │
│                          ▼                                         │
│                   ┌──────────────┐   ┌──────────────┐             │
│                   │Speech Output │   │Knowledge Graph│             │
│                   └──────────────┘   └──────────────┘             │
│                          │                                         │
│                          ▼                                         │
│                   ┌──────────────┐                                 │
│                   │   Web UI     │                                 │
│                   └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Functional Requirements

### FR-100: Perception

| ID | Requirement | Priority |
|---|---|---|
| FR-101 | System MUST connect to Gemini Live API and receive streaming audio/transcript | P0 |
| FR-102 | System MUST identify different speakers (diarization) | P0 |
| FR-103 | System MUST detect conversational pauses (brief < 500ms, natural < 2000ms, extended < 5000ms) | P0 |
| FR-104 | System MUST produce `TranscriptSegment` objects with speaker, text, timestamps, and confidence | P0 |

### FR-200: Semantic Compression

| ID | Requirement | Priority |
|---|---|---|
| FR-201 | System MUST compress raw transcript segments into `SemanticDelta` objects containing structured `SemanticUnit` entries | P0 |
| FR-202 | Each `SemanticUnit` MUST have a type (proposal, decision, assumption, risk, question, objection, clarification, statement, agreement), content, and confidence | P0 |
| FR-203 | Semantic compression MUST use Gemini API with structured output | P0 |
| FR-204 | Compression SHOULD reduce token volume by at least 5x compared to raw transcript | P1 |

### FR-300: Context Engine

| ID | Requirement | Priority |
|---|---|---|
| FR-301 | System MUST maintain a structured world model (`ContextState`) including: current topic, assumptions, decisions, risks, open questions, stakeholder states | P0 |
| FR-302 | System MUST produce frozen, immutable `ContextSnapshot` objects for agent consumption | P0 |
| FR-303 | System MUST track topic changes and maintain topic history | P0 |
| FR-304 | System MUST track decisions with supporting and opposing arguments | P0 |
| FR-305 | System MUST track assumptions with challenge status | P0 |
| FR-306 | System MUST produce a Decision Graph on demand | P0 |

### FR-400: Cognitive Kernel

| ID | Requirement | Priority |
|---|---|---|
| FR-401 | System MUST execute a deterministic Cognitive Tick for each semantic event: compress → update context → snapshot → read blackboard → dispatch → collect → arbitrate → gate | P0 |
| FR-402 | System MUST dispatch identical `ContextSnapshot + SemanticDelta + BlackboardState` to all agents in parallel | P0 |
| FR-403 | System MUST collect `AgentResult` (proposal + blackboard entries) from all agents per tick | P0 |
| FR-404 | System MUST run arbitration on collected proposals | P0 |
| FR-405 | System MUST record tick history for debugging and UI display | P1 |

### FR-500: Stakeholder Agents

| ID | Requirement | Priority |
|---|---|---|
| FR-501 | System MUST support 4 stakeholder agents: CTO, Product, Finance, Research | P0 |
| FR-502 | Each agent MUST independently evaluate context and produce an `InterventionProposal` or null | P0 |
| FR-503 | Each agent MUST return `BlackboardEntry` observations as part of its `AgentResult` | P0 |
| FR-504 | Agents MUST use Gemini API for domain reasoning with structured output | P0 |
| FR-505 | Research Agent MUST be able to call Gemini Search inline during evaluation | P1 |
| FR-506 | Agents MUST NOT directly communicate with each other | P0 |

### FR-600: Intervention Policy

| ID | Requirement | Priority |
|---|---|---|
| FR-601 | System MUST compute urge score using multiplicative formula: `(relevance × severity × novelty × confidence × informationGain × timeCriticality) / costOfInterrupting` | P0 |
| FR-602 | System MUST compute novelty as `1 - max(cosineSimilarity(proposed, previousInterventions))` | P0 |
| FR-603 | System MUST compute cost of interrupting based on: speaker-in-flow, recent interruptions, emotional intensity | P0 |
| FR-604 | System MUST apply Blackboard convergence bonus when ≥2 agents flag related concerns | P1 |

### FR-700: Arbitration

| ID | Requirement | Priority |
|---|---|---|
| FR-701 | System MUST drop proposals below global urgency threshold (0.3) | P0 |
| FR-702 | System MUST deduplicate proposals with cosine similarity > 0.85 | P0 |
| FR-703 | System MUST check Attention Budget before granting permission | P0 |
| FR-704 | System MUST enforce per-agent cooldown (60 seconds default) | P0 |
| FR-705 | System MUST raise urgency threshold by 50% when speaker is in flow | P1 |
| FR-706 | System MUST grant speaking permission to at most one agent per tick | P0 |
| FR-707 | System MUST store rejected and deferred proposals in Knowledge Graph | P0 |

### FR-800: Attention Budget

| ID | Requirement | Priority |
|---|---|---|
| FR-801 | System MUST initialize Attention Budget at meeting start (default: 100 units) | P0 |
| FR-802 | System MUST consume budget on each granted interruption | P0 |
| FR-803 | System MUST replenish budget passively during uninterrupted human discussion (+5 units/minute) | P0 |
| FR-804 | System MUST enter cooldown period when budget reaches 0 | P0 |
| FR-805 | System MUST dynamically increase minimum urgency threshold after each interruption (+0.05) | P1 |
| FR-806 | System MUST decrease threshold during extended silence (-0.02/2min, floor: 0.3) | P1 |

### FR-900: Cognitive Blackboard

| ID | Requirement | Priority |
|---|---|---|
| FR-901 | System MUST maintain a shared Blackboard where agents post observations, warnings, hypotheses, questions, confidence updates, agreements, and disagreements | P0 |
| FR-902 | Blackboard entries from tick N MUST only be visible to agents in tick N+1 | P0 |
| FR-903 | Blackboard state MUST be readable by the Arbitrator for convergence detection | P0 |
| FR-904 | Blackboard MUST be displayed in the UI | P0 |

### FR-1000: Speech Output

| ID | Requirement | Priority |
|---|---|---|
| FR-1001 | System MUST convert authorized agent responses into spoken audio via Gemini TTS | P0 |
| FR-1002 | System MUST format responses for both speech (SSML) and display (markdown) | P1 |
| FR-1003 | System MUST enforce speaking token expiration (max duration) | P1 |

### FR-1100: User Interface

| ID | Requirement | Priority |
|---|---|---|
| FR-1101 | UI MUST display live transcript with speaker labels | P0 |
| FR-1102 | UI MUST display Attention Budget as a prominent visual gauge | P0 |
| FR-1103 | UI MUST display current Cognitive Blackboard state | P0 |
| FR-1104 | UI MUST display stakeholder agent status (idle/thinking/speaking) | P0 |
| FR-1105 | UI MUST display Decision Graph | P0 |
| FR-1106 | UI MUST display current topic and meeting context | P1 |
| FR-1107 | UI MUST display intervention queue (pending/granted/rejected) | P1 |
| FR-1108 | UI MUST update in real-time via WebSocket | P0 |

### FR-1200: Knowledge Graph

| ID | Requirement | Priority |
|---|---|---|
| FR-1201 | System MUST store all decisions, interventions, assumptions, risks, and key statements as `KnowledgeEntry` objects | P0 |
| FR-1202 | System MUST produce a `MeetingRecord` export on meeting end | P1 |
| FR-1203 | System MUST support querying entries by type | P0 |

---

## 11. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Latency** | Cognitive Tick MUST complete in < 5 seconds end-to-end (compress → arbitrate) |
| NFR-02 | **Latency** | Semantic compression MUST complete in < 2 seconds |
| NFR-03 | **Latency** | Agent evaluation MUST complete in < 3 seconds (parallel execution) |
| NFR-04 | **Latency** | UI updates MUST reflect events within 200ms of emission |
| NFR-05 | **Reliability** | System MUST gracefully handle Gemini API rate limits and transient failures |
| NFR-06 | **Reliability** | A failed agent evaluation MUST NOT block the Cognitive Tick |
| NFR-07 | **Modularity** | Every module MUST communicate only through defined interfaces and events |
| NFR-08 | **Modularity** | No circular dependencies between modules |
| NFR-09 | **Type Safety** | TypeScript strict mode enabled; no `any` types in public interfaces |
| NFR-10 | **Testability** | Every module MUST be independently testable with mocked dependencies |
| NFR-11 | **Observability** | Every Cognitive Tick MUST be logged with full state for replay |
| NFR-12 | **Scalability** | Architecture MUST support adding new agents without modifying existing code |

---

## 12. Architecture Overview

The system consists of seven primary modules organized around a **Cognitive Tick** — a deterministic, CPU-like cognition cycle that executes once per semantic event.

```
Gemini Live → Perception Engine → Semantic Compressor → Event Bus
                                                           │
                                                    Cognitive Kernel
                                                    (executes Tick)
                                                           │
                                              ┌────────────┼────────────┐
                                              ▼            ▼            ▼
                                        Context      Blackboard    Agents (×4)
                                        Engine                          │
                                                                        ▼
                                                              Arbitrator + Budget
                                                                        │
                                                                        ▼
                                                                  Speech Output
```

### Module Dependency Rules

```
Allowed:
  Perception → EventBus (publish)
  Compressor → (pure — called by Perception)
  ContextEngine → EventBus (subscribe + publish)
  CognitiveKernel → EventBus, ContextEngine, AgentRegistry, Blackboard, KnowledgeGraph
  Agents → (no dependencies — receive data, return results)
  SpeechOutput → (called by Kernel)
  KnowledgeGraph → (no dependencies — called by Kernel)
  UI → EventBus (subscribe only)

Forbidden:
  Agent → Agent
  Agent → ContextEngine (direct)
  Agent → Blackboard (direct post)
  Perception → Kernel
  Any circular dependency
```

---

## 13. Stakeholder Agents

Each agent represents **organizational incentives**, not personalities.

### CTO Agent

| Attribute | Value |
|---|---|
| **Domain** | Architecture, scalability, implementation feasibility, engineering effort |
| **Triggers on** | Technical proposals, architecture decisions, scalability assumptions, technology choices |
| **Typical interventions** | "This approach requires 3-6 months migration effort" / "Current team lacks K8s expertise" |
| **Tone** | Advisory, technically precise |

### Product Agent

| Attribute | Value |
|---|---|
| **Domain** | User value, feature scope, UX implications, product strategy |
| **Triggers on** | Feature proposals, scope changes, user impact assumptions, UX decisions |
| **Typical interventions** | "This feature serves <1% of users" / "User research contradicts this assumption" |
| **Tone** | Supportive but grounded |

### Finance Agent

| Attribute | Value |
|---|---|
| **Domain** | ROI, pricing, infrastructure cost, burn rate, financial sustainability |
| **Triggers on** | Cost assumptions, revenue projections, infrastructure decisions, hiring implications |
| **Typical interventions** | "ROI is negative if migration exceeds 4 months" / "This doubles our infrastructure cost" |
| **Tone** | Cautionary, data-driven |

### Research Agent

| Attribute | Value |
|---|---|
| **Domain** | External validation, competitor analysis, market research, evidence gathering |
| **Triggers on** | Unvalidated claims, market assumptions, competitor mentions, technology comparisons |
| **Typical interventions** | "Competitor X launched similar feature and saw 40% churn" / "Recent study contradicts this assumption" |
| **Tone** | Neutral, evidence-based |
| **Special capability** | Can call Gemini Search inline during evaluation for real-time evidence |

---

## 14. Intervention Policy

### The Urge Formula

```
urge = (relevance × severity × novelty × confidence × informationGain × timeCriticality)
       ─────────────────────────────────────────────────────────────────────────────────
                                       costOfInterrupting
```

**Why multiplicative, not additive:** If ANY factor is zero, the urge is zero. A highly relevant but zero-novelty intervention (repeating what was already said) scores 0. An additive formula would allow one strong factor to override a disqualifying weakness.

### Factor Definitions

| Factor | Range | Source | Description |
|---|---|---|---|
| Relevance | 0–1 | Agent LLM | Does this discussion intersect with my responsibilities? |
| Severity | 0–1 | Agent LLM | How damaging is the current assumption if unchallenged? |
| Novelty | 0–1 | Cosine similarity | `1 - max(similarity with previous interventions)`. Prevents repetition. |
| Confidence | 0–1 | Agent LLM | How certain am I in my assessment? |
| Information Gain | 0–1 | Agent LLM | How much would discussion quality improve if I speak? |
| Time Criticality | 0–1 | Agent LLM | Will waiting reduce the usefulness of this intervention? |
| Cost of Interrupting | >0 | Runtime | `max(0.1, speakerInFlow×1.5 + recentInterruptions×0.3 + emotionalIntensity×0.8)` |

### Blackboard Convergence Bonus

```
If ≥2 agents posted related warnings/observations:
  convergenceBonus = 0.15 × number_of_converging_agents

finalUrge = urge + convergenceBonus
```

---

## 15. Cognitive Kernel

### The Cognitive Tick

One semantic event = one deterministic cognition cycle.

```
TICK START
  │
  ├── 1. Semantic Compressor extracts meaning from transcript
  ├── 2. Context Engine updates world model with SemanticDelta
  ├── 3. Context Projector creates frozen ContextSnapshot
  ├── 4. Kernel reads current Blackboard state
  ├── 5. Cognitive Scheduler dispatches (snapshot + delta + blackboard) to all agents
  ├── 6. All agents evaluate in parallel → return AgentResult
  ├── 7. Kernel posts new Blackboard entries
  ├── 8. Proposal Pool collects proposals
  ├── 9. Arbitrator evaluates proposals (with Blackboard convergence)
  ├── 10. Attention Gate grants or denies speaking permission
  ├── 11. If granted: agent generates response → Speech Output
  ├── 12. Attention Budget consumed
  │
TICK END
```

### Why a Tick Matters

- **Deterministic:** Same inputs = same outputs. Replayable.
- **Bounded:** No runaway processing. Each tick has a known maximum duration.
- **Debuggable:** You can inspect any tick in isolation.
- **Observable:** UI can show tick-by-tick cognition in real-time.

---

## 16. Cognitive Blackboard

### Concept

The Cognitive Blackboard is a shared observation board inspired by classic AI blackboard architectures. Agents do not communicate with each other directly. Instead, they post observations to the Blackboard, and other agents read those observations on subsequent ticks.

### Entry Types

| Type | Description | Example |
|---|---|---|
| `observation` | Factual observation from agent's domain | "Migration requires 3-6 months" |
| `warning` | Risk or concern flagged | "Current team has no K8s expertise" |
| `hypothesis` | Uncertain prediction or theory | "Serverless may be cheaper" |
| `question` | Unanswered question from agent's perspective | "What is the target timeline?" |
| `confidence_update` | Change in confidence about a prior entry | "ROI negative if migration > 4 months" |
| `agreement` | Endorsement of another entry | "Concur with CTO's migration estimate" |
| `disagreement` | Challenge to another entry | "Market data contradicts this assumption" |

### Collaboration Example

```
Tick 12: CTO posts warning: "Team lacks K8s expertise"
Tick 12: Research posts hypothesis: "Serverless may be cheaper"

Tick 13: Finance reads both, posts confidence_update: "ROI negative under these constraints"
Tick 13: Finance submits InterventionProposal (urgency: 0.81)
Tick 13: Arbitrator sees 3 agents converging → convergence bonus → grants Finance
```

---

## 17. UX Flows

### Flow 1: Normal Listening (Most Common)

1. Human speaks
2. Transcript appears in Transcript Panel
3. Agent status indicators briefly show "thinking..."
4. Agents return to "idle" — no intervention needed
5. Blackboard may show new observations (visible to user)
6. Attention Budget unchanged

### Flow 2: Agent Intervention

1. Human makes a statement with an implicit assumption
2. Semantic Compressor extracts: `{ type: "assumption", content: "..." }`
3. Agent status shows "thinking..."
4. CTO Agent produces proposal (urgency: 0.78)
5. Arbitrator grants permission
6. Attention Budget decreases (gauge animates)
7. CTO Agent's avatar highlights
8. AI speaks via TTS: "I'd like to flag a concern about..."
9. Intervention appears in Decision Graph
10. Agent returns to "idle"

### Flow 3: Budget Exhaustion

1. After multiple interventions, Attention Budget reaches 0
2. Budget gauge shows empty state with "COOLDOWN" label
3. An agent produces a high-urgency proposal
4. Arbitrator rejects: `budget_exhausted`
5. Proposal stored in Knowledge Graph as "deferred"
6. UI shows: "AI is listening silently. Budget will replenish."
7. After cooldown, budget gradually replenishes
8. Normal operation resumes

### Flow 4: Blackboard Convergence

1. Multiple agents post related observations over 2-3 ticks
2. Blackboard Panel shows entries accumulating
3. On the next tick, an agent's proposal gets convergence bonus
4. Arbitrator grants with amplified urgency
5. UI highlights the Blackboard entries that contributed

---

## 18. Success Metrics

### Demo Success Criteria

| Metric | Target | Measurement |
|---|---|---|
| End-to-end tick completes | < 5 seconds | Tick duration log |
| Agents produce relevant proposals | ≥ 80% of proposals are contextually relevant | Manual review |
| Attention Budget constrains behavior | AI speaks ≤ 8 times in a 10-minute demo | Count interventions |
| Blackboard shows collaboration | ≥ 2 instances of agents building on each other's observations | Visual inspection |
| Decision Graph is populated | ≥ 3 decision nodes with evidence lineage | UI inspection |
| System stays silent when appropriate | ≥ 60% of ticks result in no intervention | Tick history |

### Hackathon Judging Criteria Alignment

| Likely Criterion | Conclave Answer |
|---|---|
| Innovation | Cognitive OS paradigm, Attention Budget, Blackboard, Semantic Compression |
| Technical Depth | 7-layer architecture, typed event system, deterministic tick model |
| Gemini API Usage | Gemini Live (audio), Gemini structured output (compression + agent reasoning), Gemini Search (Research Agent), Gemini TTS (speech output) |
| Practicality | Real problem (incomplete stakeholder coverage in meetings), real solution |
| Presentation | Observable cognition, Attention Budget gauge, Decision Graph |

---

## 19. Assumptions

| ID | Assumption |
|---|---|
| A1 | Gemini Live API provides streaming transcription with sufficient accuracy for semantic compression |
| A2 | Gemini API latency allows agent evaluation to complete within 3 seconds |
| A3 | Gemini API rate limits are sufficient for 4 parallel agent evaluations per tick |
| A4 | A single meeting session fits comfortably in memory |
| A5 | Browser Web Audio API can capture microphone input for streaming to Gemini Live |
| A6 | Judges will observe the system via the web UI during the demo |

---

## 20. Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Gemini Live API latency too high for real-time feel | High | Pre-batch transcript segments; increase tick window; show "thinking" state in UI |
| R2 | Agent evaluations produce low-quality proposals | High | Extensive prompt engineering; structured output validation; fallback to conservative behavior |
| R3 | Rate limiting during demo | Critical | Implement exponential backoff; reduce agent count if needed; cache repeated evaluations |
| R4 | Semantic Compressor produces incorrect classifications | Medium | Include raw transcript in agent context as fallback; validate with confidence thresholds |
| R5 | Attention Budget too aggressive (AI never speaks) | Medium | Tune initial budget and replenish rate; have configurable presets |
| R6 | Attention Budget too lenient (AI too noisy) | Medium | Same tuning; err on the side of silence |
| R7 | Demo connectivity issues | High | Have a pre-recorded fallback demo with simulated audio input |

---

## 21. Constraints

| Constraint | Impact |
|---|---|
| Hackathon time limit | Must prioritize P0 requirements; P1 is best-effort |
| 4 developers | Must maximize parallel development; architecture supports this via module isolation |
| Gemini API dependencies | All AI reasoning depends on Gemini availability |
| Single meeting lifecycle | No persistent storage across sessions |
| Browser-based UI | Limited to Web APIs for audio capture and playback |

---

## 22. Future Roadmap

These are explicitly out of scope for the hackathon but represent the natural evolution path:

| Phase | Feature |
|---|---|
| v0.2 | Persistent Knowledge Graph across meetings |
| v0.3 | Custom agent creation (define role + responsibilities → agent) |
| v0.4 | Plugin system for new perception modalities (screen share, documents) |
| v0.5 | Multi-user observer mode with role-based views |
| v1.0 | Production deployment with database-backed storage, authentication, and multi-tenancy |

---

## 23. Demo Flow

### Recommended Demo Script (8-10 minutes)

**Setup:** Two humans discussing a technical decision — e.g., "Should we migrate to Kubernetes?"

**Minute 0-1: Introduction**
- Show the UI. Explain: "This is not a chatbot. Watch what happens."
- Start the meeting. AI is silent.
- Attention Budget shows 100%.

**Minute 1-3: Normal Discussion**
- Humans discuss freely. Transcript flows.
- Agent status indicators briefly show "thinking..." then return to "idle."
- Blackboard starts accumulating observations.
- Point out: "The AI is reasoning but choosing not to speak."

**Minute 3-5: First Intervention**
- Human makes an assumption: "Traffic will probably be under 10k users."
- CTO Agent's status shows "thinking..." → Proposal submitted.
- Attention Budget decreases.
- CTO speaks: "Based on current growth trajectory, traffic will likely exceed 100k within 6 months. This changes the architecture requirements significantly."
- Decision Graph shows the assumption challenged.

**Minute 5-7: Blackboard Convergence**
- Research Agent posts a hypothesis. Finance Agent reads it on next tick, posts a confidence update.
- Show the Blackboard building up.
- Finance Agent intervenes with convergence bonus: "Multiple signals suggest negative ROI under current assumptions."
- Attention Budget drops further.

**Minute 7-8: Budget Exhaustion**
- After several interventions, budget reaches low state.
- An agent has a proposal but it's rejected: "Budget low. Only critical insights will interrupt."
- Show: "The AI has learned that human attention is finite."

**Minute 8-9: Decision Graph**
- Show the Decision Graph: decisions → arguments → evidence → agents.
- "This is not minutes. This is how the decision formed."

**Minute 9-10: Closing**
- "Conclave treats human attention as a scarce computational resource. The Cognitive Kernel schedules AI cognition around it."
- "Stakeholder agents are applications running on top of a Cognitive Operating System."

---

## 24. Google DeepMind Hackathon Alignment

### Gemini API Usage Depth

| API | Usage | Depth |
|---|---|---|
| **Gemini Live** | Real-time streaming audio transcription and diarization | Core infrastructure — the entire perception layer |
| **Gemini Structured Output** | Semantic Compressor (transcript → semantic units), Agent evaluation (context → scoring + recommendation) | Used in every Cognitive Tick, ~5 structured calls per tick |
| **Gemini Search** | Research Agent real-time evidence gathering | Inline during agent evaluation |
| **Gemini TTS** | Agent speech output | Intervention delivery |

### Why This Is a DeepMind-Worthy Project

1. **Novel abstraction:** The Cognitive Tick is a new computational primitive for human-AI interaction.
2. **Systems-level thinking:** Not prompt engineering. An actual operating system with scheduling, arbitration, and resource management.
3. **Principled AI safety:** The Attention Budget is an alignment mechanism — AI self-regulates based on human cognitive load.
4. **Classic AI meets modern LLMs:** The Cognitive Blackboard adapts a foundational AI architecture (blackboard systems) to multi-agent LLM coordination.
5. **Deep Gemini integration:** Four distinct Gemini APIs used synergistically, not superficially.

### The One-Sentence Pitch

> "Conclave is a Cognitive Operating System where human attention is the scarce resource and AI stakeholders are applications scheduled around it."
