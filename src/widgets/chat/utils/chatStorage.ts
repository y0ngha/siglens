import type { ChatMessage, ChatSession, Timeframe } from '@y0ngha/siglens-core';

export const CHAT_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 (ms)
export const MAX_STORED_MESSAGES = 40;

export function buildStorageKey(symbol: string, timeframe: Timeframe): string {
    return `siglens_chat_${symbol.toUpperCase()}_${timeframe}`;
}

export function loadSession(key: string): ChatMessage[] {
    return loadSessionFull(key).messages;
}

interface ChatSessionLoadResult {
    messages: ChatMessage[];
    savedAt: number | null;
}

export function loadSessionFull(key: string): ChatSessionLoadResult {
    if (typeof window === 'undefined') return { messages: [], savedAt: null };
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { messages: [], savedAt: null };
        const session: ChatSession = JSON.parse(raw);
        if (Date.now() - session.savedAt > CHAT_HISTORY_TTL_MS) {
            localStorage.removeItem(key);
            return { messages: [], savedAt: null };
        }
        return { messages: session.messages, savedAt: session.savedAt };
    } catch {
        return { messages: [], savedAt: null };
    }
}

export function saveSession(key: string, messages: ChatMessage[]): void {
    if (typeof window === 'undefined') return;
    try {
        const session: ChatSession = {
            messages: messages.slice(-MAX_STORED_MESSAGES),
            savedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(session));
    } catch {
        // 스토리지 용량 초과 등 무시
    }
}
