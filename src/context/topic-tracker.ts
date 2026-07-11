import { ContextState, AgentTopic, Topic } from '../shared/types';

export class TopicTracker {
  track(state: ContextState, topics: readonly AgentTopic[], timestamp: number): boolean {
    let changed = false;

    for (const topic of topics) {
      changed = this.trackTopic(state, topic, timestamp) || changed;
    }

    return changed;
  }

  private trackTopic(state: ContextState, topic: AgentTopic, timestamp: number): boolean {
    if (state.currentTopic && state.currentTopic.id === topic.id) {
      const nextTopic: Topic = {
        id: topic.id,
        title: topic.label,
        startedAtTimestamp: state.currentTopic.startedAtTimestamp,
      };

      if (topicsEqual(state.currentTopic, nextTopic)) return false;
      state.currentTopic = nextTopic;
      return true;
    }

    if (state.currentTopic) {
      upsertTopic(state.topicHistory, state.currentTopic);
    }

    const existingHistoryIndex = state.topicHistory.findIndex(
      (historicalTopic) => historicalTopic.id === topic.id,
    );
    const existingHistoryTopic =
      existingHistoryIndex >= 0 ? state.topicHistory[existingHistoryIndex] : null;

    if (existingHistoryIndex >= 0) {
      state.topicHistory.splice(existingHistoryIndex, 1);
    }

    state.currentTopic = {
      id: topic.id,
      title: topic.label,
      startedAtTimestamp: existingHistoryTopic?.startedAtTimestamp ?? timestamp,
    };

    return true;
  }
}

function upsertTopic(topics: Topic[], topic: Topic): boolean {
  const existingIndex = topics.findIndex((candidate) => candidate.id === topic.id);

  if (existingIndex === -1) {
    topics.push(topic);
    return true;
  }

  if (topicsEqual(topics[existingIndex], topic)) return false;
  topics[existingIndex] = topic;
  return true;
}

function topicsEqual(left: Topic, right: Topic): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.startedAtTimestamp === right.startedAtTimestamp
  );
}
