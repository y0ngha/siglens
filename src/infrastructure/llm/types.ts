import type { LlmProvider } from '@/domain/llm';

/** A user-registered LLM provider entry returned to the client (no API key). */
export interface RegisteredProvider {
    /** The LLM provider identifier. */
    provider: LlmProvider;
    /** Timestamp when the API key was last updated. */
    updatedAt: Date;
}
