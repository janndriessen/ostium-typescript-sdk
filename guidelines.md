# Project Guidelines

- TypeScript
- Modular
- Tested
- Simple

## Dependencies

- Must always be exact versions (pinned) — enforced by `save-exact=true` in `.npmrc`
- Do not use wildcard versions
- Prefer stable versions over beta/alpha versions
- Only use dependencies that are necessary
- Research online for any issues with current versions

## How to handle tasks

- Each task should be a single, actionable item
- Track which modules/functions are affected by each task
- Think about tests first
- Only introduce code that is necessary for this task (incl. dependencies)
- Atomic commits

## Tooling

### Linting & Formatting — Biome

- Run `pnpm lint` before committing (lint + format + import sorting in one pass)
- Run `pnpm lint:fix` to auto-fix
- `pnpm ci` in CI: runs Biome in read-only mode + `tsc --noEmit` + tests
- Pin Biome to an exact version — it evolves rapidly
- No ESLint or Prettier — Biome replaces both

### Testing — Vitest v4

- Use explicit imports: `import { describe, it, expect } from 'vitest'` (no globals)
- Co-locate unit tests with source (`src/foo.test.ts`)
- Separate integration tests into `tests/integration/`
- v8 coverage provider, 80% threshold minimum
- Reference Python SDK tests where applicable for test cases and edge cases
- Make sure to discuss trade-offs and decisions

### Building — tsup

- `pnpm build` outputs ESM + `.d.ts` (no CJS — ESM-only)
- `prepare` script runs `tsup` on `pnpm install` (for git installs)

## Testing Strategy

- Write tests first
- Test each module independently
- Test integration between modules
- Test edge cases
- Test error cases

## Build Order

Implementation sequence (each step builds on the previous):

1. **Scaffold** — `package.json`, `tsconfig.json`, `tsup.config.ts`, `biome.json`, `vitest.config.ts`, `.gitignore`, install deps
2. **Types + Config + Errors** — no dependencies, everything else imports from these
3. **Utils** — depends on types only
4. **ABIs** — fetch from Python SDK, export as `const`
5. **Price** — simplest network module (just fetch)
6. **Subgraph** — needs GraphQL queries from Python SDK
7. **Trading** — most complex, depends on everything above
8. **Client** — wires modules together
9. **Index** — barrel exports

Tests should be written at each step, not deferred to the end.

## Documentation

- Document each module
- Document integration points
- Document edge cases
- Document error cases
- JSDocs

## Final

- Always test
- Always run `pnpm lint:fix` before committing (auto-fixes lint + format)
- Verify with `pnpm lint` (read-only, used in CI)
- Ask if things could be simplified
- Keep it simple
- Wait for approval before committing
