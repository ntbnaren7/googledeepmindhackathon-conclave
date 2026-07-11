export class ConclaveError extends Error {
  constructor(message: string, public readonly module: string, public readonly code: string) {
    super(`[${module}] ${message}`);
  }
}
