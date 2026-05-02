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
import { isFreeChatModel, getRequiredProviderForModel } from '@/domain/llm';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
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

    if (!isFreeChatModel(model)) {
        const user = await getCurrentUser();
        if (user === null) {
            return { ok: false, error: 'model_not_allowed' };
        }
        const requiredProvider = getRequiredProviderForModel(model);
        const { db } = getDatabaseClient();
        const repo = new DrizzleUserApiKeyRepository(db);
        const keyRecord = await repo.findByUserAndProvider(
            user.id,
            requiredProvider
        );
        if (keyRecord === null) {
            return { ok: false, error: 'user_api_key_required' };
        }
        // User has a registered key. Actual BYOK call adapter is implemented in a follow-up issue;
        // the request proceeds with the system Gemini key as an interim fallback.
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
