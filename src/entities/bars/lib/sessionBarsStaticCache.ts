import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { BarsData, FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    requestSessionWindow,
    type SessionWindow,
} from '@/shared/api/market/requestSessionWindow';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { SESSION_KEYED_CACHE_REVALIDATE_SECONDS } from '@/shared/config/time';
import {
    shortenRevalidateForIncompleteSession,
    shortenRevalidateForRuntimeDegrade,
} from '@/shared/cache/buildDegradedRevalidate';
import {
    isStorableCoverage,
    sessionCoverage,
    type SessionCoverage,
} from '@/shared/lib/sessionCoverage';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { loadBarsData } from './loadBarsData';
import { lastBarSessionDate, toSessionBarsData } from './sessionBars';
import { symbolFearGreedSnapshot } from './symbolFearGreed';

/**
 * # 세션 키 정적 캐시 — `[symbol]` 탭의 revalidate clamp 해소
 *
 * Next 16.3의 `unstable_cache`는 렌더 중 읽힌 모든 엔트리(HIT·MISS 무관)의 `revalidate` 중
 * **최솟값으로 라우트 revalidate를 낮춘다**(`unstable-cache.js`의 `prerender-legacy` 분기 —
 * `src/__tests__/guards/unstableCacheRevalidateLowering.test.ts`가 그 분기를 고정한다).
 * 공유 레이아웃이 헤더 공포·탐욕 칩 때문에 6h 봉 캐시(`getBarsStatic`)를 읽던 탓에, 12h·24h를
 * 선언한 탭이 전부 6h로 내려가 있었다(2026-10 운영 실측: `/AAPL/fundamental` s-maxage 21600).
 *
 * 그렇다고 봉 캐시의 revalidate를 24h로 올리면 차트 탭의 봉이 하루 묵는다. 대신 **신선도를
 * 키로 옮긴다**: 키에 시장의 마지막 마감 세션 날짜(`lastClosedSessionDate`, 마감 + EOD 발행
 * 버퍼, 요청당 한 번 `requestSessionWindow`)를 넣으면 세션이 넘어가는 순간 다음 렌더가 새 키를 읽으므로, revalidate는 가장 긴 탭
 * 선언값(24h, `SESSION_KEYED_CACHE_REVALIDATE_SECONDS`) 이상으로 둘 수 있다. cron·
 * `revalidateTag`에 기대지 않는다 — 세션 롤 뒤 첫 재생성이 곧 갱신이다.
 *
 * ## 무엇을 저장하는가 — `sessionCoverage`
 *
 * 마지막 봉 날짜를 키의 세션(`current`)·직전 거래일(`previous`)과 비교한다(`sessionCoverage`).
 *
 * - **complete**(키의 세션 봉까지 있음) → 저장한다.
 * - **lagging**(직전 거래일까지만 있음) → 저장하지 않고 이 렌더에만 쓴다. 저장하면 한 세션 뒤처진
 *   값이 24h 굳는다. 렌더된 ISR HTML도 그만큼 굳지 않도록 이 렌더의 revalidate를 1h로 낮춘다
 *   (`shortenRevalidateForIncompleteSession`, 큐레이션 여부 무관). 원인은 provider EOD 발행 지연,
 *   그날 체결이 없던 저유동 종목, 그리고 **휴장일 표의 공백**이다 — KRX 표(`KR_MARKET_HOLIDAYS`)가
 *   모르는 임시 휴장일이나 `KR_CALENDAR_HORIZON` 밖 휴장일은 `lastClosedSessionDate`가 거래일로
 *   보므로 그날 키의 봉은 영영 오지 않는다. 그 세션 동안 이 종목의 탭은 렌더마다(=1h마다) provider를
 *   다시 읽는다 — 비용 상한은 탭당 하루 24회이고, 다음 세션 롤이 끝낸다.
 * - **dormant**(직전 거래일보다도 오래됨 — 거래 정지·상장폐지) → **저장한다**. 다음 롤까지 바뀔 이유가
 *   없고, 저장하지 않으면 그런 종목은 영원히 캐시되지 않아 매 렌더 provider를 부른다.
 * - **empty**(봉 0개) → 저장하지 않는다. 큐레이션 종목이면 300초 degrade 핀
 *   (`shortenRevalidateForRuntimeDegrade`, 예전 `getBarsStatic`과 같은 노출 창).
 *
 * 저장하지 않는 값을 쓰는 렌더의 계산 비용도 요청당 한 번이다: `loadSessionBars`(provider 왕복)와
 * 5년 공포·탐욕 계산(`symbolFearGreed`의 `React.cache`, 같은 `BarsData` 객체면 접힌다)이 모두 요청
 * 스코프 메모라 칩·`generateMetadata`·본문이 같은 결과를 나눠 쓴다.
 *
 * 큐레이션 종목의 provider 예외도 300초 핀을 건다.
 *
 * ## 중첩 `unstable_cache`
 *
 * 콜백 안의 `loadBarsData`는 Redis 봉 캐시(`getOrSetCache`)를 거친다. 그 안에서 부르는 다른
 * `unstable_cache`(asset info 등)는 중첩이라 Next가 캐시를 건너뛰고 직접 실행한다 — revalidate를
 * 라우트에 전파하지도 않는다. `getQuantizedBarsStatic`(React.cache + 6h `unstable_cache`)을 콜백
 * 안에서 부르지 **않는** 이유도 이것이다: 중첩 컨텍스트에서 만든 프로미스가 React.cache에 남으면,
 * 같은 요청의 차트 탭 본문이 그 메모를 받아 6h 엔트리를 읽지 않은 채 렌더된다.
 */

/**
 * 세션 키 캐시 두 개(축소 봉·칩 스냅샷)가 함께 MISS일 때 provider 왕복을 한 번으로 접는다.
 * 인자는 전부 원시값이다(`React.cache`는 `Object.is`로 키잉한다).
 */
const loadSessionBars = cache(
    async (
        ticker: string,
        fmpSymbol: string | undefined,
        sessionDate: string
    ): Promise<BarsData> =>
        toSessionBarsData(
            await loadBarsData(ticker, '1Day', fmpSymbol),
            sessionDate
        )
);

/** 콜백 안에서 던져 저장을 건너뛰는 sentinel. 값은 바깥의 holder로 넘긴다. */
class UncachedSessionValueError extends Error {}

interface SessionComputation<T> {
    readonly value: T;
    /** 저장 여부·핀 결정 — `sessionCoverage` 참고. */
    readonly coverage: SessionCoverage;
}

/** 저장하지 않은 값을 쓰는 렌더의 revalidate를 낮춘다(모듈 JSDoc의 분류표). */
async function pinUnstoredRender(
    coverage: SessionCoverage,
    ticker: string
): Promise<void> {
    if (coverage === 'lagging') {
        await shortenRevalidateForIncompleteSession();
    } else if (coverage === 'empty' && isCuratedSymbol(ticker)) {
        await shortenRevalidateForRuntimeDegrade();
    }
}

async function cacheSessionValue<T>(
    keyParts: readonly string[],
    ticker: string,
    compute: () => Promise<SessionComputation<T>>
): Promise<T> {
    // 클로저 변수 대신 객체 프로퍼티로 넘긴다 — `let`이면 TS가 선언 시점의 `null`로 좁혀 둔다.
    const holder: { unstored: SessionComputation<T> | null } = {
        unstored: null,
    };
    try {
        return await unstable_cache(
            async () => {
                // 렌더 예산: FMP가 느리면 짧게 실패해 degrade한다(`renderBudget.ts`).
                const result = await runWithRenderBudget(compute);
                if (!isStorableCoverage(result.coverage)) {
                    holder.unstored = result;
                    throw new UncachedSessionValueError(ticker);
                }
                return result.value;
            },
            [...keyParts],
            {
                revalidate: SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
                tags: [`symbol:${ticker}`],
            }
        )();
    } catch (error) {
        // Next 제어 흐름은 degrade가 아니다.
        if (isDynamicServerError(error)) throw error;
        const unstored = holder.unstored;
        if (error instanceof UncachedSessionValueError && unstored !== null) {
            await pinUnstoredRender(unstored.coverage, ticker);
            return unstored.value;
        }
        if (isCuratedSymbol(ticker)) await shortenRevalidateForRuntimeDegrade();
        throw error;
    }
}

/** 축소 봉의 마지막 봉 날짜를 세션 창에 대어 분류한다. */
function coverageOf(data: BarsData, session: SessionWindow): SessionCoverage {
    return sessionCoverage(
        lastBarSessionDate(data),
        session.current,
        session.previous
    );
}

/**
 * 세션 날짜까지로 자른 **축소 일봉**(`toSessionBarsData`) — 공포·탐욕 탭(본문·`generateMetadata`)과
 * 포지션 탭이 쓴다. 24h 이상 선언 탭이 6h 봉 캐시를 읽지 않게 하는 입구다.
 *
 * ⚠️ 지표는 `buySellVolume` 외에 비어 있다. 지표를 읽는 차트 탭은 `getQuantizedBarsStatic`을 쓴다.
 *
 * provider 예외는 그대로 던진다(호출부가 `.catch(() => null)`로 degrade). 봉 0개는 빈 `BarsData`를
 * 돌려준다(저장하지 않음) — `getBarsStatic`과 같은 계약이다. 저장 규칙은 모듈 JSDoc의 분류표다.
 */
export const getSessionBarsStatic = cache(
    async (
        ticker: string,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const upper = ticker.toUpperCase();
        const session = requestSessionWindow(marketProfile);
        return cacheSessionValue(
            ['session-bars-v1', upper, fmpSymbol ?? '', session.current],
            upper,
            async () => {
                const data = await loadSessionBars(
                    upper,
                    fmpSymbol,
                    session.current
                );
                return { value: data, coverage: coverageOf(data, session) };
            }
        );
    }
);

/**
 * 헤더 공포·탐욕 칩의 스냅샷 — 레이아웃이 **9개 탭 전부**에서 읽는다.
 *
 * 값은 수십 바이트라 cache-handler의 메모리 계층에 남는다(S3 왕복 없음). 예전에는 이 칩 하나 때문에
 * 모든 탭이 원본 봉 엔트리(~700KB, 6h)를 읽었고, 그 6h가 12h·24h 탭을 clamp했다.
 *
 * 공포·탐욕 탭 본문과 **같은 축소 봉·같은 세션 키**에서 계산하므로 그 탭에서 칩과 게이지 요약이
 * 갈리지 않는다. `null`은 점수를 낼 수 없다는 뜻(봉 부족)이고, provider 예외는 던진다.
 */
export const getSymbolFearGreedChipStatic = cache(
    async (
        ticker: string,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<FearGreedSnapshot | null> => {
        const upper = ticker.toUpperCase();
        const session = requestSessionWindow(marketProfile);
        return cacheSessionValue(
            ['symbol-fg-chip-v1', upper, fmpSymbol ?? '', session.current],
            upper,
            async () => {
                const data = await loadSessionBars(
                    upper,
                    fmpSymbol,
                    session.current
                );
                // 5년 계산은 `symbolFearGreed`의 React.cache라 같은 `data` 객체(=같은 요청의
                // `loadSessionBars` 메모)면 본문·`generateMetadata`와 한 번만 돈다.
                return {
                    value: symbolFearGreedSnapshot(data),
                    coverage: coverageOf(data, session),
                };
            }
        );
    }
);
