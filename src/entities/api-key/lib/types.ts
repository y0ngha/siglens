import type { LlmProvider } from './constants';

export type GateMode = 'auth' | 'byok';

export type ApiKeyActionStatus = 'idle' | 'success' | 'error';

/**
 * Machine-readable classification for {@link ApiKeyActionState} errors.
 *
 * - `invalid_key_format`: provider/apiKey input failed validation.
 * - `server_misconfigured`: the LLM encryption key env var is missing or invalid.
 * - `storage_unavailable`: the database upsert failed (transient or constraint).
 * - `unknown`: catch-all for unclassified failures.
 */
export type ApiKeyActionErrorCode =
    | 'invalid_key_format'
    | 'server_misconfigured'
    | 'storage_unavailable'
    | 'unknown';

export interface ApiKeyActionState {
    status: ApiKeyActionStatus;
    message: string | null;
    /** Present only when `status === 'error'`. */
    code?: ApiKeyActionErrorCode;
}

export interface RegisteredProvider {
    provider: LlmProvider;
    updatedAt: Date;
}
