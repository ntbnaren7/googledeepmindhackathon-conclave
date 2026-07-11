export interface ISpeechOutput {
  speak(response: any, token: any): Promise<void>;
}
