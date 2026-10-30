/**
 * 다이제스트 쿼리·대기 결과를 화면 상태로 접는 순수 함수.
 */
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';

/** 다이제스트 훅의 화면 상태 — 소비자가 `status`로 분기한다. */
export type MarketNewsDigestState =
    | { status: 'loading' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: Error; retry: () => void };

interface DigestStateInput {
    /** 화면에 있는 다이제스트(쿼리 데이터). SSR seed도 쿼리 초기 데이터로 여기에 들어온다. */
    result: NewsAnalysisResponse | undefined;
    /** 카드 보강 대기가 실패했을 때의 사용자용 오류. */
    waitError: Error | null;
    /** 다이제스트 쿼리 실패. */
    queryError: Error | null;
    retry: () => void;
}

/**
 * 이미 받은 결과는 어떤 실패보다 우선한다(재조회·대기 실패로 화면의 본문을 버리지 않는다).
 * 결과가 없을 때만 대기 실패 → 쿼리 실패 → 로딩 순으로 본다.
 */
export function resolveDigestState({
    result,
    waitError,
    queryError,
    retry,
}: DigestStateInput): MarketNewsDigestState {
    if (result !== undefined) return { status: 'done', result };
    if (waitError !== null) return { status: 'error', error: waitError, retry };
    if (queryError !== null) {
        return { status: 'error', error: queryError, retry };
    }
    return { status: 'loading' };
}

/** 쿼리가 던진 값이 `Error`가 아니면 일반 문구의 오류로 바꾼다. */
export function toDigestError(reason: unknown, fallbackMessage: string): Error {
    return reason instanceof Error ? reason : new Error(fallbackMessage);
}
