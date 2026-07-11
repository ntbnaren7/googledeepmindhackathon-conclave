/**
 * Central configuration
 */
export function loadConfig() {
  return {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      searchModel: process.env.GEMINI_SEARCH_MODEL || 'gemini-3.5-flash',
    },
    perception: {
      session: { 
        apiKey: process.env.GEMINI_API_KEY || '', 
        model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview', 

        sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000', 10) 
      },
      compressionBatchSize: parseInt(process.env.COMPRESSION_BATCH_SIZE || '3', 10),
      compressionIntervalMs: parseInt(process.env.COMPRESSION_INTERVAL_MS || '5000', 10),
    },
    meeting: {
      meetingId: process.env.MEETING_ID || 'demo-meeting-1',
      objective: process.env.MEETING_OBJECTIVE || 'Technical design review',
      participants: [],
      agentIds: ['cto', 'product', 'finance', 'research'],
      attentionBudget: {
        initialBudget: parseInt(process.env.ATTENTION_INITIAL_BUDGET || '100', 10),
        replenishRate: parseInt(process.env.ATTENTION_REPLENISH_RATE || '5', 10),
        interruptionBaseCost: parseInt(process.env.ATTENTION_BASE_COST || '10', 10),
        cooldownMs: parseInt(process.env.ATTENTION_COOLDOWN_MS || '30000', 10),
        minThreshold: parseFloat(process.env.ATTENTION_MIN_THRESHOLD || '0.3'),
      },
      agentTimeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '15000', 10),
      /** Min ms between evaluation cycles. Tune with EVALUATION_DEBOUNCE_MS. */
      evaluationDebounceMs: parseInt(process.env.EVALUATION_DEBOUNCE_MS || '8000', 10),
      /** Ms to stay quiet after any agent speaks. Tune with POST_SPEECH_QUIET_MS. */
      postSpeechQuietMs: parseInt(process.env.POST_SPEECH_QUIET_MS || '15000', 10),
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      wsPort: parseInt(process.env.WS_PORT || '3001', 10),
    }
  };
}
