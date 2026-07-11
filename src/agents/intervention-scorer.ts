export class InterventionScorer {
  calculateUrge(params: any): number { return 0; }
  calculateNovelty(proposed: string, history: any[]): number { return 1; }
}
