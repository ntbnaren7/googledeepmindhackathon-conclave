import { ISpeechOutput } from './interfaces';

export class SpeechSynthesizer implements ISpeechOutput {
  constructor(private config: any) {}
  async speak(response: any, token: any): Promise<void> {
    // TODO: Call Gemini TTS
  }
}
