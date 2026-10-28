'use client';

import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';

interface UseFearGreedShareRegistrationInput {
    symbol: string;
    /** 종목 표시명(회사명). 없으면 심볼로 대신한다. */
    displayName?: string;
    snapshot: FearGreedSnapshot | null;
    /** 스냅샷을 받은 시각(밀리초) — `useFearGreedFromSymbol`의 `dataUpdatedAt`. */
    dataUpdatedAt: number;
}

/** 공유 등록에는 실행할 분석 작업이 없다 — 점수는 이미 계산돼 있다. */
function noopTrigger(): void {}

/**
 * 현재 공포·탐욕 스냅샷을 헤더 공유 버튼에 등록한다.
 *
 * 등록은 `kind`·`status`·`symbol`·`displayName`·`analyzedAt`이 바뀔 때만 다시 일어나므로,
 * 재조회가 가져온 새 스냅샷이 공유에 실리려면 `analyzedAt`이 따라 바뀌어야 한다. 그래서
 * 스냅샷을 받은 시각을 `analyzedAt`으로 넘긴다. 공포·탐욕은 결정적 계산이라 비동기 분석
 * 작업이 없고, `trigger`는 공유 버튼이 종류와 무관하게 부르기 때문에 두는 빈 함수다.
 */
export function useFearGreedShareRegistration({
    symbol,
    displayName,
    snapshot,
    dataUpdatedAt,
}: UseFearGreedShareRegistrationInput): void {
    useRegisterShareable({
        kind: 'fear-greed',
        status: snapshot ? 'success' : 'unavailable',
        result: snapshot,
        context: {
            symbol,
            displayName: displayName ?? symbol,
            analyzedAt: new Date(dataUpdatedAt).toISOString(),
        },
        trigger: noopTrigger,
    });
}
