'use server';

import { headers } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import type { AnalysisResponse, Timeframe, ChatPromptPayload } from '@/domain/types';
import type { ChatMessage, ChatActionResult } from '@/domain/chat/types';
import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';
import {
    hashIp,
    tryConsumeToken,
    getRemainingTokens,
} from '@/infrastructure/chat/tokenStore';

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
        (error as { status: number }).status === 429
    );
}

async function callGemini(
    apiKey: string,
    systemPrompt: string,
    messages: ChatPromptPayload['messages']
): Promise<string> {
    const genai = new GoogleGenAI({ apiKey });
    const response = await genai.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        contents: messages,
        config: { systemInstruction: systemPrompt },
    });
    return response.text ?? '';
}

async function callGeminiWithFallback(
    freeApiKey: string | undefined,
    paidApiKey: string,
    systemPrompt: string,
    messages: ChatPromptPayload['messages']
): Promise<string> {
    if (freeApiKey) {
        try {
            return await callGemini(freeApiKey, systemPrompt, messages);
        } catch {
            // free key failed — fall back to paid key
        }
    }
    return callGemini(paidApiKey, systemPrompt, messages);
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

    try {
        const responseText = await callGeminiWithFallback(
            process.env.GEMINI_CHAT_FREE_API_KEY,
            paidApiKey,
            systemPrompt,
            messages
        );
        const remainingTokens = await getRemainingTokens(hashedIp);
        return { ok: true, message: responseText, remainingTokens };
    } catch (error) {
        if (isRateLimitError(error)) {
            return { ok: false, error: 'rate_limited' };
        }
        return { ok: false, error: 'server_error' };
    }
}
