import type { LlmProvider } from '@/domain/llm';

export interface ApiKeyActionState {
    status: 'idle' | 'success' | 'error';
    message: string | null;
}

export type SaveApiKeyState = ApiKeyActionState;
export type DeleteApiKeyState = ApiKeyActionState;

export interface RegisteredProvider {
    provider: LlmProvider;
    updatedAt: Date;
}
