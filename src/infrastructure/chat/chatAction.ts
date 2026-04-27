'use server';

import {
    GEMINI_2_5_FLASH_MODEL,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    ChatModel,
    Timeframe,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

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
    model: ChatModel = GEMINI_2_5_FLASH_MODEL
): Promise<ChatActionResult> {
    const paidApiKey = process.env.GEMINI_API_KEY;
    if (!paidApiKey) {
        return { ok: false, error: 'server_error' };
    }

    try {
        const clientIp = await getClientIp();
        return await requestChatCompletion({
            clientIp,
            symbol,
            timeframe,
            analysis,
            history,
            userMessage,
            model,
            freeApiKey: process.env.GEMINI_CHAT_FREE_API_KEY,
            paidApiKey,
        });
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
