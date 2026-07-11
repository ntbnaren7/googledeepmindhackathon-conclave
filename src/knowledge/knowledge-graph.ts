import { IKnowledgeGraph } from './interfaces';

export class KnowledgeGraph implements IKnowledgeGraph {
  private entries: any[] = [];
  store(entry: any): string { return ''; }
  getAll(): any[] { return this.entries; }
  getByType(type: string): any[] { return []; }
  getDecisionNodes(): any[] { return []; }
  export(): any { return {}; }
}
