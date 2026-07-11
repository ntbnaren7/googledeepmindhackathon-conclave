import { IKnowledgeGraph } from './interfaces';
import {
  Assumption,
  DecisionNode,
  KnowledgeEntry,
  MeetingRecord,
  Risk,
  SemanticUnitType,
} from '../shared/types';

export class KnowledgeGraph implements IKnowledgeGraph {
  private readonly entries: KnowledgeEntry[] = [];

  store(entry: KnowledgeEntry): string {
    this.entries.push(cloneEntry(entry));
    return entry.id;
  }

  getAll(): KnowledgeEntry[] {
    return this.entries.map(cloneEntry);
  }

  getByType(type: SemanticUnitType): KnowledgeEntry[] {
    return this.entries.filter((entry) => entry.type === type).map(cloneEntry);
  }

  getDecisionNodes(): DecisionNode[] {
    return this.getLatestEntriesByType('decision').map((entry) => ({
      id: entry.id,
      statement: entry.content,
      status: 'proposed',
      supporting: [],
      opposing: [],
      timestamp: entry.timestamp,
    }));
  }

  export(): MeetingRecord {
    return {
      topics: [],
      decisions: this.getDecisionNodes(),
      assumptions: this.getAssumptions(),
      risks: this.getRisks(),
      interventions: [],
      generatedAt: Date.now(),
    };
  }

  private getAssumptions(): Assumption[] {
    return this.getLatestEntriesByType('assumption').map((entry) => ({
      id: entry.id,
      content: entry.content,
      status: 'active',
      sourceUnitId: entry.id,
      timestamp: entry.timestamp,
    }));
  }

  private getRisks(): Risk[] {
    return this.getLatestEntriesByType('risk').map((entry) => ({
      id: entry.id,
      content: entry.content,
      severity: 'med',
      status: 'open',
      timestamp: entry.timestamp,
    }));
  }

  private getLatestEntriesByType(type: SemanticUnitType): KnowledgeEntry[] {
    const latestEntries = new Map<string, KnowledgeEntry>();

    for (const entry of this.entries) {
      if (entry.type === type) {
        latestEntries.set(entry.id, entry);
      }
    }

    return Array.from(latestEntries.values()).map(cloneEntry);
  }
}

function cloneEntry(entry: KnowledgeEntry): KnowledgeEntry {
  return structuredClone(entry) as KnowledgeEntry;
}
