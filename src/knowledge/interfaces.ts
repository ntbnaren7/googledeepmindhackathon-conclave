export interface IKnowledgeGraph {
  store(entry: any): string;
  getAll(): any[];
  getByType(type: string): any[];
  getDecisionNodes(): any[];
  export(): any;
}
