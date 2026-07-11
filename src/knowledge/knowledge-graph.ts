import { IKnowledgeGraph } from './interfaces';
import {
  DecisionNode,
  KnowledgeEntry,
  MeetingRecord,
  SemanticUnitType,
} from '../shared/types';

export class KnowledgeGraph implements IKnowledgeGraph {
  private readonly entries: KnowledgeEntry[] = [];

  store(entry: KnowledgeEntry): string {
    this.entries.push(entry);
    return entry.id;
  }

  getAll(): KnowledgeEntry[] {
    return [...this.entries];
  }

  getByType(type: SemanticUnitType): KnowledgeEntry[] {
    return this.entries.filter((entry) => entry.type === type);
  }

  getDecisionNodes(): DecisionNode[] {
    return [];
  }

  export(): MeetingRecord {
    return {
      topics: [],
      decisions: this.getDecisionNodes(),
      assumptions: [],
      risks: [],
      interventions: [],
      generatedAt: Date.now(),
    };
  }
}
