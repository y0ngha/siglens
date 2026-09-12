// `getAgentSuggestions` is intentionally excluded — `api.ts` imports the
// market-news DB repository and the agent LLM provider (both `server-only`
// chains). A client bundle pulling this in would break the build. Server
// consumers import from `@/entities/agent-suggestions/api` directly (app
// layer or this same entity — see entities/CLAUDE.md §barrel 제외 대상).
export type { AgentSuggestionsInput } from './model';
export { suggestionsCacheKey } from './lib/cacheKey';
export type { SuggestionsCacheKeyInput } from './lib/cacheKey';
