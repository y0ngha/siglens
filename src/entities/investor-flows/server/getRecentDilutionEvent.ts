import 'server-only';
import { cache } from 'react';
import { isE2E } from '@/shared/api/e2eEnv';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { DrizzleSecFilingsRepository } from '../api/investorFlowsFilingsRepository';
import { addDays } from '../lib/investorFlowsDates';
import { investorFlowsTag } from '../lib/investorFlowsTag';
import {
    DILUTION_BADGE_FETCH_LIMIT,
    DILUTION_BADGE_LOOKBACK_DAYS,
    pickRecentDilutionEvent,
    type RecentDilutionEvent,
} from '../lib/recentDilutionEvent';
import type { OfferingRecord } from '../model';
import { getInvestorFlowsDataProvider } from './getInvestorFlowsDataProvider';

export interface RecentDilutionEventDeps {
    /** `sinceDate` 이후 증자 공시(최신순 `limit`건). */
    readOfferings(
        symbol: string,
        sinceDate: string,
        limit: number
    ): Promise<readonly Pick<OfferingRecord, 'filingDate' | 'kind'>[]>;
    now(): Date;
}

/** 저장소에서 최근 창의 증자 공시를 읽어 배지 사건 하나로 줄인다. 읽기 실패는 그대로 던진다(캐시되지 않게). */
export async function loadRecentDilutionEvent(
    symbol: string,
    deps: RecentDilutionEventDeps
): Promise<RecentDilutionEvent | null> {
    const today = toUtcIsoDate(deps.now());
    const filings = await deps.readOfferings(
        symbol,
        addDays(today, -DILUTION_BADGE_LOOKBACK_DAYS),
        DILUTION_BADGE_FETCH_LIMIT
    );
    return pickRecentDilutionEvent(filings, today);
}

/**
 * 실제 의존. 운영은 수급 탭과 같은 `DrizzleSecFilingsRepository.findOfferings`(DB 한 번, 외부 호출 없음)를 읽는다.
 * E2E(`E2E_TEST=1`)에는 DB가 없으므로 수급 탭과 같은 가짜 스냅샷의 증자 공시를 쓴다 — 수집 중 모드면 비어 있다.
 */
const realDeps: RecentDilutionEventDeps = {
    async readOfferings(symbol, sinceDate, limit) {
        if (isE2E()) {
            const snapshot =
                await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(
                    symbol
                );
            return (snapshot?.offerings ?? []).map(filing => ({
                filingDate: filing.filingDate,
                kind: filing.kind,
            }));
        }
        const client = tryGetDatabaseClient();
        if (client === null)
            throw new Error('[dilution-badge] database unavailable');
        return new DrizzleSecFilingsRepository(client.db).findOfferings(
            symbol,
            sinceDate,
            limit
        );
    },
    now: () => new Date(),
};

/**
 * 렌더 경로의 정적 캐시(`staticSymbolCache`) — 차트 탭 ISR이 정적 생성 중 DB 읽기에 막히지 않게 한다.
 *
 * revalidate는 12시간(수급 스냅샷과 같다). 차트 탭 선언(6h)보다 길어야 라우트 revalidate를 끌어내리지 않는다
 * (`symbolTabRevalidateClamp.test.ts`). 태그는 수급 탭과 같은 `investorFlowsTag` — 증자 공시 수집 뒤 그 태그를
 * 무효화하면 배지도 함께 갱신된다. 반환 형태가 바뀌면 키 버전(`-v1`)을 올린다.
 */
export function getRecentDilutionEventStatic(
    symbol: string
): Promise<RecentDilutionEvent | null> {
    const upper = symbol.toUpperCase();
    return staticSymbolCache<RecentDilutionEvent | null>(
        ['investor-flows:dilution-badge-v1', upper],
        upper,
        () => loadRecentDilutionEvent(upper, realDeps),
        [investorFlowsTag(upper)],
        SECONDS_PER_HALF_DAY
    );
}

/**
 * 차트 헤더 희석 배지용 graceful 로더. 실패는 배지 없음(`null`)으로 조용히 degrade하고 한 줄만 남긴다 — 배지는 보조
 * 정보라 페이지를 깨거나 noindex로 돌리지 않는다. 오류 처리가 캐시 함수 밖이라 실패가 12시간 동안 캐시되지 않는다.
 * Next의 정적 생성 제어 흐름 오류(`DYNAMIC_SERVER_USAGE`)는 실패가 아니므로 다시 던진다.
 */
export const getRecentDilutionEvent = cache(
    async (symbol: string): Promise<RecentDilutionEvent | null> => {
        try {
            return await getRecentDilutionEventStatic(symbol);
        } catch (error) {
            if (isDynamicServerError(error)) throw error;
            console.error(
                '[getRecentDilutionEvent] 증자 공시 조회 실패, 배지 생략:',
                error
            );
            return null;
        }
    }
);
