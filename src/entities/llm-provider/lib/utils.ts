import type {
    AiContents,
    ConversationTurn,
    ModelSpec,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS } from '@y0ngha/siglens-core';
import type { ProviderCallLimits } from '../model';

export interface ProviderTurn {
    role: 'user' | 'assistant';
    content: string;
}

export function toProviderTurns(contents: AiContents): ProviderTurn[] {
    if (typeof contents === 'string') {
        return [{ role: 'user', content: contents }];
    }
    return contents.map((turn: ConversationTurn) => ({
        role: turn.role,
        content: turn.text,
    }));
}

/**
 * apiModelId(예: 'claude-sonnet-5')로 ModelSpec을 역방향 조회한다.
 * anthropic.ts와 openai.ts 양쪽에서 동일하게 사용하던 로컬 함수를 통합.
 *
 * `Object.values(MODEL_SPECS)`의 반환 타입은 `ModelSpec[]`으로 넓어지므로
 * 캐스트가 필요하다. MODEL_SPECS가 IndicatorKey → ModelSpec 형태임이
 * siglens-core 타입으로 보장되므로 안전한 캐스트다.
 */
export function findSpecByApiModelId(
    apiModelId: string
): ModelSpec | undefined {
    return (Object.values(MODEL_SPECS) as ModelSpec[]).find(
        s => s.apiModelId === apiModelId
    );
}

/**
 * 호출자 상한(`limits.maxOutputTokens`)과 스펙 상한 중 작은 값. 상한이 없으면 스펙 값 그대로다 —
 * 호출자가 스펙보다 큰 값을 넘겨도 모델이 거부할 값을 보내지 않는다.
 */
export function resolveMaxOutputTokens(
    specMax: number,
    limits: ProviderCallLimits | undefined
): number {
    return limits?.maxOutputTokens === undefined
        ? specMax
        : Math.min(specMax, limits.maxOutputTokens);
}

/**
 * OpenAI·Anthropic SDK 생성자에 넘길 전송 옵션. 지정한 필드만 싣는다 — 빈 객체면 SDK
 * 기본값(10분 timeout, 재시도 2회)이 그대로 남아 기존 호출자의 동작이 바뀌지 않는다.
 */
export function toSdkTransportOptions(limits: ProviderCallLimits | undefined): {
    timeout?: number;
    maxRetries?: number;
} {
    return {
        ...(limits?.timeoutMs !== undefined
            ? { timeout: limits.timeoutMs }
            : {}),
        ...(limits?.maxRetries !== undefined
            ? { maxRetries: limits.maxRetries }
            : {}),
    };
}
