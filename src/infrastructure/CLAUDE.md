# Infrastructure Layer Rules

## Core Principle

Handles communication with external systems (Alpaca API, AI Providers, Skills file I/O).
Define interfaces (`types.ts`) **before** implementation.

**Dependency:** `→ see docs/ARCHITECTURE.md` for full layer dependency rules.

---

## Function Rules

- Always use `export function` (named function declaration)
- No `export default` or arrow function exports
- Classes allowed only for special cases (e.g., Skills Loader, Providers)

---

## Module Structure

### market/ (Alpaca API)

`→ see docs/API.md` for full Alpaca API spec.

### ai/ (AI Provider)

- Supports multiple AI providers (Claude, Gemini, etc.)
- Interchangeable via common interface (`AIProvider`)
- Provider selected by `AI_PROVIDER` env var (`createAIProvider()` in factory.ts)

### skills/ (Skills Loader)

- `FileSkillsLoader` recursively scans `skills/` for `.md` files → parses into `Skill[]`
- Parsed `Skill[]` is passed to `domain/analysis/prompt.ts`
- Domain has no file I/O, so infrastructure must load and inject

### market/barsApi.ts

- Fetches bars from Alpaca, then calls domain indicator functions
- `infrastructure → domain` import is allowed by dependency rules
- Used by `getBarsAction.ts` Server Action
