import 'server-only';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { GeminiThinkingLevel } from '@y0ngha/siglens-core';

/**
 * 도메인 thinking level → SDK의 `ThinkingLevel` enum.
 *
 * 와이어 포맷은 대소문자를 가리지 않지만 SDK 타입이 이 enum이라 경계에서 매핑한다.
 */
const THINKING_LEVEL_TO_SDK: Record<GeminiThinkingLevel, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
};
import type { AiContents, ConversationTurn } from '@y0ngha/siglens-core';
import type { ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractGeminiUsage, logUsage } from '../lib/usage';

interface GeminiChatOptions extends ProviderCallOptions {
    /**
     * Gemini thinking level. Pass `'minimal'` to disable extended thinking for
     * deterministic tasks (translation, classification). Omit to use the
     * model's default thinking behaviour.
     *
     * ⚠️ 숫자 `thinkingBudget`을 쓰지 않는다. 3세대 Gemini는 리터럴 0을 400으로
     * 거부하거나(`gemini-3.5-flash-lite`·`3.6-flash`·`3.1-pro-preview`) 에러
     * 없이 무시한다(`3.7-flash`·`3.8-flash`) — 2026-09-06 실측. 조용한 무시가
     * 특히 위험해서 level 문자열로 전환했다. 모델별로 받는 최저 level이 다르므로
     * (`minimal` 미지원 모델은 `low`가 바닥) 호출 측이 `supportsHardOff`로
     * 검증한 모델만 `'minimal'`을 보낸다.
     */
    thinkingLevel?: GeminiThinkingLevel;
}

/** Gemini SDK's native conversation-turn shape. */
interface GeminiTurn {
    role: 'user' | 'model';
    parts: [{ text: string }];
}

/**
 * Convert siglens-core's provider-neutral `AiContents` to the Gemini SDK's
 * native turn shape. Gemini expects `{ role: 'user' | 'model', parts: [{ text }] }`,
 * whereas siglens-core 0.11.4 emits `{ role: 'user' | 'assistant', text }`.
 */
function toGeminiContents(contents: AiContents): string | GeminiTurn[] {
    if (typeof contents === 'string') {
        return contents;
    }
    return contents.map((turn: ConversationTurn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
    }));
}

export async function callGeminiChat({
    apiKey,
    model,
    contents,
    systemInstruction,
    thinkingLevel,
    jobId = CHAT_JOB_ID,
}: GeminiChatOptions): Promise<string> {
    const startedAt = Date.now();
    const genai = new GoogleGenAI({ apiKey });

    const hasSystemInstruction = systemInstruction !== undefined;
    const hasThinkingLevel = thinkingLevel !== undefined;

    const response = await genai.models.generateContent({
        model,
        contents: toGeminiContents(contents),
        ...(hasSystemInstruction || hasThinkingLevel
            ? {
                  config: {
                      ...(hasSystemInstruction ? { systemInstruction } : {}),
                      ...(hasThinkingLevel
                          ? {
                                thinkingConfig: {
                                    thinkingLevel:
                                        THINKING_LEVEL_TO_SDK[thinkingLevel],
                                },
                            }
                          : {}),
                  },
              }
            : {}),
    });
    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractGeminiUsage(response.usageMetadata),
    });

    if (response.text === null || response.text === undefined) {
        throw new Error('[gemini] Provider returned null/undefined response');
    }
    return response.text;
}
