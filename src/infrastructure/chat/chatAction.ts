'use server';

import {
    GEMINI_2_5_FLASH_MODEL,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import { isFreeChatModel } from '@/domain/llm';
import { headers } from 'next/headers';
import { callGeminiWithKeyFallback } from '@/infrastructure/ai/gemini';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ModelId = GEMINI_2_5_FLASH_MODEL
): Promise<ChatActionResult> {
    const paidApiKey = process.env.GEMINI_API_KEY;
    if (!paidApiKey) {
        return { ok: false, error: 'server_error' };
    }

    // Server-side guard: BYOK call adapter is implemented in a follow-up issue.
    // Until then, premium model requests are rejected here even if the UI gate was bypassed.
    if (!isFreeChatModel(model)) {
        return { ok: false, error: 'model_not_allowed' };
    }

    try {
        const clientIp = await getClientIp();
        return await requestChatCompletion(
            {
                clientIp,
                symbol,
                timeframe,
                analysis,
                history,
                userMessage,
                model,
                freeApiKey: process.env.GEMINI_CHAT_FREE_API_KEY,
                paidApiKey,
            },
            {
                callAiProvider: callGeminiWithKeyFallback,
            }
        );
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
