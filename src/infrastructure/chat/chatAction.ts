'use server';

import { headers } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
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
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
): Promise<string> {
    const genai = new GoogleGenAI({ apiKey });
    const response = await genai.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        systemInstruction: systemPrompt,
        contents: messages,
    });
    return response.text ?? '';
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string
): Promise<ChatActionResult> {
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

    const paidApiKey = process.env.GEMINI_API_KEY;
    if (!paidApiKey) {
        return { ok: false, error: 'server_error' };
    }

    try {
        const freeApiKey = process.env.GEMINI_CHAT_FREE_API_KEY;
        let responseText: string;

        if (freeApiKey) {
            try {
                responseText = await callGemini(freeApiKey, systemPrompt, messages);
            } catch {
                responseText = await callGemini(paidApiKey, systemPrompt, messages);
            }
        } else {
            responseText = await callGemini(paidApiKey, systemPrompt, messages);
        }

        const remainingTokens = await getRemainingTokens(hashedIp);
        return { ok: true, message: responseText, remainingTokens };
    } catch (error) {
        if (isRateLimitError(error)) {
            return { ok: false, error: 'rate_limited' };
        }
        return { ok: false, error: 'server_error' };
    }
}
