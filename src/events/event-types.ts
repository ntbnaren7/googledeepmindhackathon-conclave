export enum EventType {
  SPEAKER_STARTED = 'speaker.started',
  SPEAKER_STOPPED = 'speaker.stopped',
  TRANSCRIPT_UPDATE = 'transcript.update',
  PAUSE_DETECTED = 'pause.detected',
  DELTA_PRODUCED = 'delta.produced',
  TICK_STARTED = 'tick.started',
  TICK_COMPLETED = 'tick.completed',
  INTERRUPT_GRANTED = 'interrupt.granted',
  AGENT_SPEAKING = 'agent.speaking',
  BLACKBOARD_UPDATED = 'blackboard.updated',
  CONTEXT_UPDATED = 'context.updated',
  MEETING_STARTED = 'meeting.started'
}
