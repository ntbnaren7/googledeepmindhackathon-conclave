export class CognitiveBlackboard {
  private entries: any[] = [];
  post(entry: any) { this.entries.push(entry); }
  getState() { return this.entries; }
}
