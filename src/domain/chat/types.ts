export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export type ChatLoadingPhase = 'analyzing' | 'generating';

export interface ChatSession {
    messages: ChatMessage[];
    savedAt: number; // Unix timestamp (ms)
}

export type ChatErrorCode = 'token_exhausted' | 'rate_limited' | 'server_error';

export type ChatActionResult =
    | { ok: true; message: string; remainingTokens: number }
    | { ok: false; error: ChatErrorCode };
