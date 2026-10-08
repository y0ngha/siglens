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

/** 호출 전체 마감(`limits.timeoutMs`)을 넘겼을 때 던지는 오류. */
export class ProviderCallTimeoutError extends Error {
    constructor(readonly timeoutMs: number) {
        super(`[llm-provider] call exceeded ${timeoutMs}ms deadline`);
        this.name = 'ProviderCallTimeoutError';
    }
}

/**
 * 호출 전체를 묶는 마감. 스트리밍 어댑터(DeepSeek·Anthropic)가 쓴다.
 *
 * SDK의 `timeout`은 **응답 헤더가 도착할 때까지만** 잰다(`fetchWithTimeout`이 fetch가 resolve되면
 * 타이머를 지운다). 스트림 본문 읽기는 마감이 없어, 토큰이 느리게 흐르면 호출이 `timeoutMs`를
 * 훨씬 넘겨 이어지고 그동안 호출자의 락·비용 계산이 깨진다. 그래서 헤더 전부터 본문 끝까지를
 * 이 마감이 한 번에 묶는다.
 *
 * - `signal`: SDK 요청에 넘겨 만료 시 실제 연결을 끊는다. `timeoutMs`가 없으면 `undefined`.
 * - `guard(work)`: `work`와 마감을 경주시킨다. 만료되면 {@link ProviderCallTimeoutError}로 거절한다.
 *   SDK가 abort에 반응하지 않는 경우에도 호출자는 마감에 풀려난다.
 * - `dispose()`: 정상·실패 종료 시 타이머를 정리한다(`finally`에서 호출).
 */
export interface CallDeadline {
    readonly signal: AbortSignal | undefined;
    guard<T>(work: Promise<T>): Promise<T>;
    dispose(): void;
}

export function createCallDeadline(
    timeoutMs: number | undefined
): CallDeadline {
    if (timeoutMs === undefined) {
        return {
            signal: undefined,
            guard: work => work,
            dispose: () => {},
        };
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new ProviderCallTimeoutError(timeoutMs));
        }, timeoutMs);
    });
    // 아무도 경주시키지 않은 채 만료돼도 unhandled rejection이 되지 않게 한다.
    expiry.catch(() => {});
    return {
        signal: controller.signal,
        guard: work => Promise.race([work, expiry]),
        dispose: () => {
            if (timer !== undefined) clearTimeout(timer);
        },
    };
}
