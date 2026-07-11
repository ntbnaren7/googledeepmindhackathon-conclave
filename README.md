# Conclave

A Cognitive Operating System for real-time technical decision making and multi-agent meeting intervention. Built for the Google DeepMind Hackathon.

Conclave orchestrates a panel of autonomous AI stakeholder personas (CTO, Product, Finance, Research) that listen to real-time audio streams, reason over evolving context, and voice immediate interventions when domain-specific fallacies, unverified claims, or impractical assumptions occur.

---

## Architecture Overview

```
                        +---------------------------------------+
                        |          User Microphone / UI         |
                        +---------------------------------------+
                                           |
                                     (PCM Audio)
                                           v
+-----------------------------------------------------------------------------------+
| Perception & Live Audio Gateway (src/perception/)                                 |
|                                                                                   |
|  +-----------------+    +---------------------+    +---------------------------+  |
|  | WS Server       | -> | Agent Live Sessions | -> | Gemini Live API           |  |
|  | (16kHz PCM I/O) |    | (4 Concurrent Pool) |    | (24kHz Native Audio Out)  |  |
|  +-----------------+    +---------------------+    +---------------------------+  |
|           |                        |                             |                |
|           +------------------------+-----------------------------+                |
|                                    |                                              |
|                                    v                                              |
|                      +---------------------------+                                |
|                      | Agent Live Pool           |                                |
|                      | (400ms Arbitration Gate)  |                                |
|                      +---------------------------+                                |
+-----------------------------------------------------------------------------------+
                                     |
                         (Urgency-Ranked Speech Winner)
                                     v
+-----------------------------------------------------------------------------------+
| Cognitive Kernel & Shared State (src/kernel/, src/context/)                       |
|                                                                                   |
|  +------------------------+   +-------------------+   +------------------------+  |
|  | Attention Gate         |   | Blackboard        |   | Context Engine         |  |
|  | (Cooldown & Budgeting) |   | (Shared Memory)   |   | (Rolling Snapshot)     |  |
|  +------------------------+   +-------------------+   +------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Core Technical Features

### 1. Concurrent Multi-Persona Audio Council
- **Four Dedicated Live Sessions**: CTO, Product, Finance, and Research agents operate independent, persistent real-time sessions against the Gemini Live API (`gemini-live-2.5-flash-preview`).
- **Domain-Specific Silence Protocol**: Each persona follows a strict default-silence instruction. Agents only break silence when an explicit domain assumption is violated.

### 2. Instant Mid-Speech Interruption
- **Real-Time User Speech Tracking**: Incoming audio is transcribed continuously. As soon as user speech is detected, the gateway signals active user speech to the agent pool.
- **Calibrated Urgency Arbitration**: Proposals are parsed for trailing urgency tags (`[LOW]`, `[MED]`, `[HIGH]`, `[CRITICAL]`). When an agent breaks silence to interject, it receives a default urgency of `0.75` (`HIGH`).
- **Mid-Speech Cut-In Threshold**: While the user is speaking, the arbitration threshold is calibrated to `0.50`, ensuring any valid domain objection immediately interrupts the speaker.

### 3. Arbitration & Attention Budgeting
- **400ms Arbitration Window**: Competing proposals generated concurrently by multiple agents are collected and ranked by urgency score. The highest-priority persona wins the floor.
- **Post-Speech Dynamic Cooldown**: Prevents acoustic pile-ons and dead air by enforcing a brief 3,000ms quiet window after an intervention finishes, while allowing active user speech to bypass the cooldown instantly.
- **Attention Budget Regulation**: Monitors cumulative interruptions and dynamically throttles low-urgency interjections when the meeting budget depletes.

---

## Stakeholder Personas

| Persona | Domain Focus | Intervention Triggers |
|---------|--------------|-----------------------|
| **CTO** | System Architecture & Reliability | Scalability bottlenecks, unverified performance claims, missing test coverage, security risks |
| **Product** | User Experience & Scope | Feature bloat, unvalidated user needs, roadmap drift, timeline feasibility |
| **Finance** | Unit Economics & ROI | Unsubstantiated infrastructure costs, runway impact, unbudgeted capital expenditures |
| **Research** | Empirical Validation & Rigor | Unbacked claims, flawed statistical reasoning, lack of benchmark references |

---

## Directory Structure

```
src/
├── perception/           # Real-time Gemini Live audio sessions, arbitration pool, and connectors
├── kernel/               # Cognitive kernel, attention budget, scheduler, and blackboard memory
├── context/              # Context engine and decision graph trackers
├── agents/               # Domain persona implementations and intervention scorers
├── events/               # Event bus and structured event definitions
├── server/               # Real-time WebSocket audio streaming server
├── ui/                   # High-performance glassmorphic UI feed and audio visualizer
└── shared/               # Core types, configuration, and structured logging
```

---

## Quick Start

### Prerequisites
- Node.js 18.x or higher
- Google Gemini API Key

### Installation

```bash
# Clone repository
git clone https://github.com/ntbnaren7/googledeepmindhackathon-conclave.git
cd conclave

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
```

Add your API key to `.env`:
```ini
GEMINI_API_KEY=your_api_key_here
PORT=3000
WS_PORT=3001
```

### Running Locally

```bash
# Terminal 1: Start backend server and WebSocket gateway
npm run dev

# Terminal 2: Start Vite frontend client
npm run dev:ui
```

Access the web interface at `http://localhost:3000`.

---

## Verification & Testing

Conclave includes a comprehensive automated test suite covering unit architecture, arbitration logic, and real-time perception pipelines.

```bash
# Run all unit and integration tests
npm test

# Run TypeScript type verification
npm run typecheck

# Run linter
npm run lint
```

---

## License

Built for the Google DeepMind Hackathon 2026.
