import {
  DecisionNode,
  KnowledgeEntry,
  MeetingRecord,
  SemanticUnitType,
} from '../shared/types';

export interface IKnowledgeGraph {
  store(entry: KnowledgeEntry): string;
  getAll(): KnowledgeEntry[];
  getByType(type: SemanticUnitType): KnowledgeEntry[];
  getDecisionNodes(): DecisionNode[];
  export(): MeetingRecord;
}
