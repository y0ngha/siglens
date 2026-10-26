import type { ModelId } from '@y0ngha/siglens-core';

/**
 * 분석 결과 객체에 서버가 덧붙이는 필드 이름. 꺼진 서버 키 모델로 들어온 요청을
 * 기본 모델로 바꿔 돌렸을 때만 실린다(`/api/analysis/stream`의 `modelFallback.ts`).
 */
export const MODEL_FALLBACK_FIELD = 'modelFallback';

/** 서버가 요청 모델 `from` 대신 `to`로 분석했다는 표시. */
export interface AnalysisModelFallback {
    readonly from: ModelId;
    readonly to: ModelId;
}

/** `done` 결과에서 대체 표시를 꺼낸다. 없거나 모양이 다르면 `null`. */
export function readAnalysisModelFallback(
    result: unknown
): AnalysisModelFallback | null {
    if (typeof result !== 'object' || result === null) return null;
    if (!(MODEL_FALLBACK_FIELD in result)) return null;
    const value: unknown = result[MODEL_FALLBACK_FIELD];
    if (typeof value !== 'object' || value === null) return null;
    if (!('from' in value) || !('to' in value)) return null;
    const { from, to } = value;
    if (typeof from !== 'string' || typeof to !== 'string') return null;
    return { from: from as ModelId, to: to as ModelId };
}

/**
 * 결과에서 대체 표시 필드를 뗀 사본. 표시는 안내용 신호일 뿐 분석 결과가 아니다 —
 * 남겨 두면 탭별 React Query 캐시(요청 모델 키)와 공유 스냅샷에 실려 다닌다.
 */
export function omitAnalysisModelFallback<T>(result: T): T {
    if (typeof result !== 'object' || result === null) return result;
    if (!(MODEL_FALLBACK_FIELD in result)) return result;
    const { [MODEL_FALLBACK_FIELD]: _omitted, ...rest } = result as Record<
        string,
        unknown
    >;
    return rest as T;
}

type Listener = (fallback: AnalysisModelFallback) => void;

/**
 * 서버가 모델을 대체했다는 사실을 화면 전체에 알리는 발행/구독 채널.
 *
 * 분석 스트림은 탭마다 훅이 따로 소비하지만(`runAnalysisStream` 호출부), 안내와
 * 모델 선택은 레이아웃의 `SymbolModelProvider` 하나가 맡는다 — 같은 이유로
 * `analysisRateLimitSignal`도 이렇게 생겼다. 모듈 상태라 서버에서 import돼도
 * 무해하다(발행은 클라이언트에서만 일어난다).
 */
const listeners = new Set<Listener>();

export function publishAnalysisModelFallback(
    fallback: AnalysisModelFallback
): void {
    listeners.forEach(listener => listener(fallback));
}

/** 구독하고, 해제 함수를 돌려준다. */
export function subscribeAnalysisModelFallback(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
