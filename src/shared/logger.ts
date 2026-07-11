type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, message, ...meta }));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('INFO', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('WARN', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('ERROR', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('DEBUG', msg, meta),
};
