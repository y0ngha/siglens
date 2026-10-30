import 'server-only';
import {
    GoogleGenAI,
    ThinkingLevel,
    type GenerateContentConfig,
    type HttpOptions,
} from '@google/genai';
import type {
    AiContents,
    ConversationTurn,
    GeminiThinkingLevel,
} from '@y0ngha/siglens-core';
import { findSpecByApiModelId, resolveMaxOutputTokens } from '../lib/utils';
import type { ProviderCallLimits, ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractGeminiUsage } from '../lib/usage';
import { createCallDeadline, runWithCallDeadline } from './callDeadline';
import { logUsage } from './logUsage';

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

interface GeminiChatOptions extends ProviderCallOptions {
    /**
     * Gemini thinking level. 번역·분류처럼 결정적인 작업에서 확장 추론을 끄려면
     * `'minimal'`을 넘긴다. 생략하면 모델의 기본 추론 동작을 따른다.
     *
     * ⚠️ 숫자 `thinkingBudget`을 쓰지 않는다. 3세대 Gemini는 리터럴 0을 400으로
     * 거부하거나(`gemini-3.5-flash-lite`·`3.6-flash`·`3.1-pro-preview`) 에러
     * 없이 무시한다(`3.7-flash`·`3.8-flash`) — 2026-09-06 실측. 조용한 무시가
     * 특히 위험해서 level 문자열을 쓴다. 모델별로 받는 최저 level이 다르므로
     * (`minimal` 미지원 모델은 `low`가 바닥) 호출 측이 `supportsHardOff`로
     * 검증한 모델만 `'minimal'`을 보낸다.
     */
    thinkingLevel?: GeminiThinkingLevel;
}

/** Gemini SDK의 네이티브 대화 턴 모양. */
interface GeminiTurn {
    role: 'user' | 'model';
    parts: [{ text: string }];
}

/**
 * siglens-core의 provider-중립 `AiContents`를 Gemini SDK의 네이티브 턴 모양으로 바꾼다.
 * Gemini는 `{ role: 'user' | 'model', parts: [{ text }] }`를 기대하지만
 * core는 `{ role: 'user' | 'assistant', text }`를 내보낸다.
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

/**
 * `generateContent`의 `config`. 넣을 것이 없으면 `undefined` — 예전처럼 `config` 키 자체를
 * 빼서, 상한을 넘기지 않는 기존 호출자(번역기)의 요청 모양이 바뀌지 않게 한다.
 *
 * 재시도는 `retryOptions.attempts`(첫 시도 포함)로 옮긴다 — `maxRetries: 0`이면 1이다.
 */
function buildGeminiConfig(
    model: string,
    systemInstruction: string | undefined,
    thinkingLevel: GeminiThinkingLevel | undefined,
    limits: ProviderCallLimits | undefined,
    abortSignal: AbortSignal | undefined
): GenerateContentConfig | undefined {
    // 스펙을 모르는 모델이면 호출자 값을 그대로 쓴다(`min(x, x) = x`).
    const maxOutputTokens =
        limits?.maxOutputTokens === undefined
            ? undefined
            : resolveMaxOutputTokens(
                  findSpecByApiModelId(model)?.maxOutputTokens ??
                      limits.maxOutputTokens,
                  limits
              );
    const httpOptions: HttpOptions = {
        ...(limits?.timeoutMs !== undefined
            ? { timeout: limits.timeoutMs }
            : {}),
        ...(limits?.maxRetries !== undefined
            ? { retryOptions: { attempts: limits.maxRetries + 1 } }
            : {}),
    };
    const config: GenerateContentConfig = {
        ...(systemInstruction !== undefined ? { systemInstruction } : {}),
        ...(thinkingLevel !== undefined
            ? {
                  thinkingConfig: {
                      thinkingLevel: THINKING_LEVEL_TO_SDK[thinkingLevel],
                  },
              }
            : {}),
        ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
        ...(Object.keys(httpOptions).length > 0 ? { httpOptions } : {}),
        ...(abortSignal !== undefined ? { abortSignal } : {}),
    };
    return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Gemini `generateContent`로 챗 한 번을 부르고 text를 돌려준다.
 * `limits.timeoutMs`는 응답 본문까지 묶는다 — SDK의 `httpOptions.timeout`은 요청 단위
 * 헤더 타임아웃이라 호출 전체를 보장하지 못한다. 만료 시 `abortSignal`로 연결을 끊는다.
 */
export async function callGeminiChat({
    apiKey,
    model,
    contents,
    systemInstruction,
    thinkingLevel,
    jobId = CHAT_JOB_ID,
    limits,
}: GeminiChatOptions): Promise<string> {
    const startedAt = Date.now();
    const genai = new GoogleGenAI({ apiKey });

    const deadline = createCallDeadline(limits?.timeoutMs);
    // config 생성과 요청 생성이 던져도 타이머가 남지 않도록 둘 다 `runWithCallDeadline` 안에서 한다.
    const response = await runWithCallDeadline(deadline, () => {
        const config = buildGeminiConfig(
            model,
            systemInstruction,
            thinkingLevel,
            limits,
            deadline.signal
        );
        return genai.models.generateContent({
            model,
            contents: toGeminiContents(contents),
            ...(config !== undefined ? { config } : {}),
        });
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
