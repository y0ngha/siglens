'use server';

import { headers } from 'next/headers';
import type {
    AnalysisResponse,
    Timeframe,
    ChatMessage,
    ChatActionResult,
} from '@/domain/types';
import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';
import {
    hashIp,
    tryConsumeToken,
    getRemainingTokens,
} from '@/infrastructure/chat/tokenStore';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

const GEMINI_CHAT_MODEL = 'gemini-2.5-flash';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

function isRateLimitError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        // @google/genai attaches an HTTP status code to error objects
        (error as { status: number }).status === 429
    );
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string
): Promise<ChatActionResult> {
    const paidApiKey = process.env.GEMINI_API_KEY;
    if (!paidApiKey) {
        return { ok: false, error: 'server_error' };
    }

    const ip = await getClientIp();
    const hashedIp = hashIp(ip);

    const allowed = await tryConsumeToken(hashedIp);
    if (!allowed) {
        return { ok: false, error: 'token_exhausted' };
    }

    const { systemPrompt, messages } = buildChatPrompt(
        symbol,
        timeframe,
        analysis,
        history,
        userMessage
    );

    const geminiContents = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
    }));

    try {
        const responseText = await callGeminiWithKeyFallback({
            freeApiKey: process.env.GEMINI_CHAT_FREE_API_KEY,
            paidApiKey,
            model: GEMINI_CHAT_MODEL,
            contents: geminiContents,
            systemInstruction: systemPrompt,
        });
        const remainingTokens = await getRemainingTokens(hashedIp);
        return { ok: true, message: responseText, remainingTokens };
    } catch (error) {
        if (isRateLimitError(error)) {
            return { ok: false, error: 'rate_limited' };
        }
        return { ok: false, error: 'server_error' };
    }
}
