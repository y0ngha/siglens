'use server';

import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';
import {
    GEMINI_2_5_FLASH_MODEL,
    VALID_CHAT_MODELS,
} from '@/domain/constants/chatModels';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    ChatModel,
    Timeframe,
} from '@/domain/types';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';
import {
    getRemainingTokens,
    hashIp,
    tryConsumeToken,
} from '@/infrastructure/chat/tokenStore';
import { headers } from 'next/headers';
import { constants } from 'node:http2';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

function getHttpErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error))
        return undefined;
    // 'status' in error guarantees key existence only, not type; verify number at runtime
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

function isRateLimitError(error: unknown): boolean {
    return (
        getHttpErrorStatus(error) === constants.HTTP_STATUS_TOO_MANY_REQUESTS
    );
}

function isServerBusyError(error: unknown): boolean {
    return (
        getHttpErrorStatus(error) === constants.HTTP_STATUS_SERVICE_UNAVAILABLE
    );
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ChatModel = GEMINI_2_5_FLASH_MODEL
): Promise<ChatActionResult> {
    if (!VALID_CHAT_MODELS.includes(model)) {
        return { ok: false, error: 'server_error' };
    }

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
            model,
            contents: geminiContents,
            systemInstruction: systemPrompt,
        });
        const remainingTokens = await getRemainingTokens(hashedIp);
        return { ok: true, message: responseText, remainingTokens };
    } catch (error) {
        if (isRateLimitError(error)) {
            return { ok: false, error: 'rate_limited' };
        }
        if (isServerBusyError(error)) {
            return { ok: false, error: 'server_busy' };
        }
        return { ok: false, error: 'server_error' };
    }
}
