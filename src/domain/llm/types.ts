import type { LlmProvider } from '@/domain/llm/constants';

export interface ApiKeyActionState {
    status: 'idle' | 'success' | 'error';
    message: string | null;
}

export interface RegisteredProvider {
    provider: LlmProvider;
    updatedAt: Date;
}
