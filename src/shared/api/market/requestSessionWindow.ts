import { cache } from 'react';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    lastClosedSessionDate,
    previousSessionDate,
} from '@/shared/lib/marketSessionDate';
import { sessionSpecFor } from './sessionSpecFor';

export interface SessionWindow {
    /** 마지막으로 마감된 세션 날짜(마감 + EOD 발행 버퍼) — 세션 키 캐시의 키. */
    readonly current: string;
    /** `current` 직전 거래일 — `sessionCoverage`의 lagging/dormant 경계. */
    readonly previous: string;
}

/**
 * 한 요청 안에서 시장의 세션 창을 **한 번만** 정한다(`React.cache`, 인자는 원시값).
 *
 * 레이아웃(헤더 칩)·`generateMetadata`·본문·시장 공포·탐욕 판독이 각자 `new Date()`를 읽으면 세션
 * 롤 경계에서 서로 다른 키를 읽어 칩·메타·본문·시장 문장이 서로 다른 세션을 말할 수 있다.
 */
export const requestSessionWindow = cache(
    (marketProfile: MarketProfileId): SessionWindow => {
        const spec = sessionSpecFor(marketProfile);
        const current = lastClosedSessionDate(spec, new Date());
        return { current, previous: previousSessionDate(spec, current) };
    }
);
