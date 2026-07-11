/**
 * Zero-dependency runtime resolver for the tsconfig `@alias/*` path mappings.
 * tsc and vitest understand these aliases, but plain `ts-node` does not, so
 * `npm run dev` needs this preload (`ts-node -r ./register-aliases.cjs`).
 * Maps `@shared/x` -> `<root>/src/shared/x` before Node's normal resolution.
 */
const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, 'src');
const ALIASES = {
  '@shared/': 'shared/',
  '@events/': 'events/',
  '@context/': 'context/',
  '@knowledge/': 'knowledge/',
  '@perception/': 'perception/',
  '@kernel/': 'kernel/',
  '@agents/': 'agents/',
  '@output/': 'output/',
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  for (const alias in ALIASES) {
    if (request.startsWith(alias)) {
      request = path.join(root, ALIASES[alias], request.slice(alias.length));
      break;
    }
  }
  return originalResolve.call(this, request, ...rest);
};
