import 'server-only';
import { unstable_cache } from 'next/cache';
import type { FearGreedReading } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { requestSessionWindow } from '@/shared/api/market/requestSessionWindow';
import { SESSION_KEYED_CACHE_REVALIDATE_SECONDS } from '@/shared/config/time';
import { shortenRevalidateForIncompleteSession } from '@/shared/cache/buildDegradedRevalidate';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import {
    isStorableCoverage,
    sessionCoverage,
} from '@/shared/lib/sessionCoverage';
import { getMarketFearGreedStatic } from './marketFearGreedStaticCache';
import { getMarketFearGreedKrStatic } from './marketFearGreedKrStaticCache';
import { getMarketFearGreedCryptoStatic } from './marketFearGreedCryptoStaticCache';
import type { MarketFearGreedViewSnapshot } from '../model';

interface MarketReadingSource {
    readonly load: () => Promise<{
        snapshot: MarketFearGreedViewSnapshot | null;
    }>;
    /** 시장 허브 정적 캐시와 같은 태그 — 허브를 무효화하면 이 판독도 함께 다시 읽힌다. */
    readonly tag: string;
}

const SOURCES: Record<MarketProfileId, MarketReadingSource> = {
    'us-equity': { load: getMarketFearGreedStatic, tag: 'market:fear-greed' },
    'kr-equity': {
        load: getMarketFearGreedKrStatic,
        tag: 'market:fear-greed:kr',
    },
    crypto: {
        load: getMarketFearGreedCryptoStatic,
        tag: 'market:fear-greed:crypto',
    },
};

/** 콜백 안에서 던져 저장을 건너뛰는 sentinel. 값은 바깥의 holder로 넘긴다. */
class IncompleteMarketReadingError extends Error {}

async function loadReading(
    marketProfile: MarketProfileId
): Promise<FearGreedReading | null> {
    const { snapshot } = await SOURCES[marketProfile].load();
    if (snapshot === null) return null;
    return {
        date: snapshot.asOf,
        score: snapshot.score,
        label: snapshot.label,
    };
}

/**
 * 종목이 속한 시장의 최신 공포·탐욕 판독 하나(날짜·점수·라벨).
 *
 * 종목 공포·탐욕 페이지가 "같은 날 시장 점수와의 차이"를 보이려고 읽는다. 값의 출처는 시장
 * 허브(`/fear-greed`, `/fear-greed/kr`, `/fear-greed/crypto`)와 **같은 로더**라 새 외부 호출이
 * 없고, 같은 세션이면 두 페이지의 시장 점수가 갈리지 않는다.
 *
 * ## 왜 허브의 1h 정적 캐시를 그대로 읽지 않는가
 *
 * Next 16.3의 `unstable_cache`는 렌더 중 읽힌 엔트리의 `revalidate` 최솟값으로 라우트를
 * clamp한다(`sessionBarsStaticCache` JSDoc). 허브 캐시는 1h라 24h를 선언한 종목 공포·탐욕 탭이
 * **1h로 재생성**되고 있었다(2026-10 운영 실측: `/AAPL/fear-greed` s-maxage 3600). 이 판독은
 * 보조 문장 하나라 1h 신선도가 필요 없다.
 *
 * 그래서 키에 **그 시장의 마지막 마감 세션 날짜**를 넣고 revalidate를 24h
 * (`SESSION_KEYED_CACHE_REVALIDATE_SECONDS`)로 둔다. 세션 날짜는 같은 요청의 종목 봉·헤더 칩과
 * 같은 값(`requestSessionWindow`, 요청당 한 번)이라 시장 문장과 종목 요약이 다른 세션을 말하지
 * 않는다. 세션이 넘어가면 다음 렌더가 새 키를 읽으므로 묵은 판독이 다음 세션까지 남지 않는다.
 *
 * ## 허브 `asOf` 규약과 완결 판정
 *
 * 세 허브 모두 조회 상한을 같은 "마지막 마감 세션"으로 끊으므로, 갱신이 끝난 허브의 `asOf`는
 * 키의 세션 날짜와 **같다**:
 * - 미국 — `fetchDailyCloses`의 `lastPublishedSessionDate` = `lastClosedSessionDate(US_EQUITY_SESSION)`.
 * - 한국 — `marketFearGreedKrCache`의 상한 = `lastClosedSessionDate(KR_EQUITY_SESSION)`.
 * - 크립토 — `lastClosedUtcDate`(UTC 어제) = `lastClosedSessionDate(CRYPTO_SESSION)`.
 *
 * 뒤처질 수 있는 경우는 일시적이다: 허브 Redis 캐시(1h)가 세션 롤 전에 만든 값을 들고 있는 창,
 * FMP·yahoo 발행 지연. 그래서 `sessionCoverage`로 가른다 — `asOf`가 키의 세션이면 저장하고,
 * 직전 거래일이면(`lagging`) 저장하지 않고 이 렌더의 revalidate를 1h로 낮춘다
 * (`shortenRevalidateForIncompleteSession` — HTML이 직전 세션 문장을 24h 들고 있지 않게).
 * 그보다 오래됐으면(`dormant` — 허브 시리즈 하나가 끊긴 장기 장애) 저장한다. 허브가 고쳐지기 전엔
 * 어차피 같은 값이고, 저장하지 않으면 매 렌더 허브를 다시 계산한다. 스냅샷 없음(`null`)은 저장하지
 * 않고 같은 1h 핀을 건다.
 *
 * 콜백 안의 허브 로더(`getMarketFearGreed*Static`)는 중첩 `unstable_cache`라 Next가 캐시를
 * 건너뛰고 아래 Redis 계층(`getCachedMarketFearGreed*`)을 직접 읽는다 — 그 1h revalidate는
 * 라우트로 전파되지 않는다.
 *
 * 실패는 `null`로 삼킨다 — 시장 점수는 종목 페이지의 보조 문장 하나일 뿐이라, 그 조회가 실패해
 * 종목 페이지 렌더(ISR)가 죽으면 안 된다.
 */
export async function getMarketFearGreedReading(
    marketProfile: MarketProfileId
): Promise<FearGreedReading | null> {
    const session = requestSessionWindow(marketProfile);
    // 클로저 변수 대신 객체 프로퍼티로 넘긴다 — `let`이면 TS가 선언 시점의 `null`로 좁혀 둔다.
    const holder: { unstored: FearGreedReading | null } = {
        unstored: null,
    };
    try {
        return await unstable_cache(
            async () => {
                const reading = await loadReading(marketProfile);
                // 스냅샷 없음(허브 데이터 부족·일시 장애를 삼킨 결과)과 한 세션 뒤처진 판독은
                // 24h 굳히지 않는다(위 JSDoc의 `sessionCoverage` 규칙).
                const coverage = sessionCoverage(
                    reading?.date ?? null,
                    session.current,
                    session.previous
                );
                if (!isStorableCoverage(coverage)) {
                    holder.unstored = reading;
                    throw new IncompleteMarketReadingError(marketProfile);
                }
                return reading;
            },
            ['market-fear-greed-reading-v1', marketProfile, session.current],
            {
                revalidate: SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
                tags: [SOURCES[marketProfile].tag],
            }
        )();
    } catch (e) {
        // Next 제어 흐름은 실패가 아니다.
        if (isDynamicServerError(e)) throw e;
        if (e instanceof IncompleteMarketReadingError) {
            await shortenRevalidateForIncompleteSession();
            return holder.unstored;
        }
        console.error(
            '[getMarketFearGreedReading] market fear-greed load failed:',
            e
        );
        return null;
    }
}
