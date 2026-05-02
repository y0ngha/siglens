import type { LlmProvider } from '@/domain/llm/constants';

export type GateMode = 'auth' | 'byok';

export type ApiKeyActionStatus = 'idle' | 'success' | 'error';

export interface ApiKeyActionState {
    status: ApiKeyActionStatus;
    message: string | null;
}

export interface RegisteredProvider {
    provider: LlmProvider;
    updatedAt: Date;
}
