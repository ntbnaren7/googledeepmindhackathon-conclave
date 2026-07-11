/**
 * persona.ts — Character and company context types for Conclave agents.
 *
 * AgentPersona encodes who an agent IS and how they behave.
 * CompanyContext encodes the meeting environment they operate in.
 *
 * Personas are STATIC (hardcoded per agent).
 * CompanyContext is DYNAMIC (loaded at session start).
 */

// ---------------------------------------------------------------------------
// AgentPersona
// ---------------------------------------------------------------------------

/**
 * The fixed character of an agent — voice, opinions, and limits.
 * Injected into every LLM prompt to produce consistent, human-feeling output.
 */
export interface AgentPersona {
  /**
   * One sentence: who this person is and what shaped them.
   * Should convey experience and worldview, not just job title.
   * @example "Pragmatic engineering lead who's seen 3 startups fail from over-engineering."
   */
  identity: string;

  /**
   * How they speak in meetings: pace, length, style, habits.
   * @example "Terse. Asks one sharp question instead of lecturing. Uses 'we' not 'I'."
   */
  speakingStyle: string;

  /**
   * What they instinctively push back on or champion.
   * These create the friction that makes them feel opinionated.
   */
  opinionBiases: string[];

  /**
   * Topics they actively avoid — outside their domain or expertise.
   * The agent must return null proposals when triggered only by these topics.
   */
  domainBoundaries: string[];

  /**
   * Natural-language rule for when this agent interrupts.
   * Forces the LLM to apply a restraint filter before proposing.
   * @example "Only when a technical claim is factually wrong or a timeline is unrealistic."
   */
  interruptCondition: string;

  /**
   * A realistic example of how this agent sounds when they DO interrupt.
   * Gives the LLM a concrete voice pattern to match.
   * @example "Wait — migrating to Kubernetes isn't a 2-week job. We're looking at 3-4 months minimum with our current infra."
   */
  exampleInterrupt: string;
}

// ---------------------------------------------------------------------------
// CompanyContext
// ---------------------------------------------------------------------------

/**
 * Runtime information about the company and meeting injected into every agent.
 * Loaded once at session start; all agents share the same instance.
 */
export interface CompanyContext {
  /** Company name. */
  name: string;

  /**
   * Stage and category description.
   * @example "Series B SaaS startup"
   */
  stage: string;

  /**
   * Industry / product domain.
   * @example "B2B DevOps tooling for enterprise engineering teams"
   */
  domain: string;

  /** Approximate headcount — gives agents a sense of scale. */
  teamSize: number;

  /**
   * Top 2-4 strategic priorities for the current quarter.
   * Agents use these to calibrate whether an idea is aligned or distracting.
   */
  currentPriorities: string[];

  /**
   * Recent significant decisions — prevents agents from re-litigating old choices.
   */
  recentDecisions: string[];

  /**
   * Primary technologies in use — gives CTO agent grounded technical opinions.
   */
  techStack: string[];

  /**
   * What this specific meeting is trying to decide.
   * Agents use this to know when a proposal is on-topic.
   */
  meetingObjective: string;
}
