export class ConclaveError extends Error {
  constructor(
    message: string,
    public readonly module: string,
    public readonly code: string,
  ) {
    super(`[${module}] ${message}`);
    this.name = 'ConclaveError';
  }
}

export class PerceptionError extends ConclaveError {
  constructor(message: string, code: string) {
    super(message, 'Perception', code);
    this.name = 'PerceptionError';
  }
}

export class AgentError extends ConclaveError {
  constructor(message: string, code: string) {
    super(message, 'Agent', code);
    this.name = 'AgentError';
  }
}

export class ArbitrationError extends ConclaveError {
  constructor(message: string, code: string) {
    super(message, 'Arbitration', code);
    this.name = 'ArbitrationError';
  }
}

export class BudgetExhaustedError extends ConclaveError {
  constructor(message: string, code: string) {
    super(message, 'Budget', code);
    this.name = 'BudgetExhaustedError';
  }
}
