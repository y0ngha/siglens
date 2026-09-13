import type { Locale } from '@/shared/i18n/locales';

/** Input to {@link getAgentSuggestions} — the AI-generated empty-screen questions (spec §4-3). */
export interface AgentSuggestionsInput {
    /** Output language for the generated questions. */
    readonly locale: Locale;
    /** Signed-in user id — only ever called for members (guests get the static fallback). */
    readonly userId: string;
    /** Current holdings; when non-empty, 2 of the questions target them (core `buildSuggestionsPrompt`). */
    readonly portfolioSymbols: readonly string[];
}
