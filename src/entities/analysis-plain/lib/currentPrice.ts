import 'server-only';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { profileIdForSymbol } from '@/shared/config/marketProfile/registry';
import { collectNumbers } from './collectFacts';
import { buildDataAsOfLabel, buildPriceAsOf } from './priceAsOf';

/**
 * `dataAsOf`(마지막 봉 시각·종가)는 분석 본문의 가격이 아니라 메타데이터다. 이 값이 든
 * payload를 "숫자가 있다"로 세면 시세 조회를 건너뛰어 현재가를 못 얻는다.
 */
function withoutDataAsOf(payload: unknown): unknown {
    if (typeof payload !== 'object' || payload === null) return payload;
    if (Array.isArray(payload)) return payload;
    const { dataAsOf: _dataAsOf, ...rest } = payload as Record<string, unknown>;
    return rest;
}

/**
 * 평이화 프롬프트에 실을 현재 주가. 실패하면 `undefined`.
 *
 * `fundamental`·`news`·`financials` payload에는 숫자 필드가 하나도 없어, 이 값이
 * 없으면 모델이 현재가를 쓸 방법이 없다. 블라인드 평가자 둘 다 같은 지점에서
 * 막혔다 — "목표주가는 나오는데 현재 주가가 없어서 싸다는 말이 진짜인지 판단이
 * 안 된다."
 *
 * ⚠️ **SSE 라우트와 프리웜 harvest가 함께 쓴다.** 라우트에만 있던 때 프리웜이
 * 이 값을 넘기지 않았고, 그 결과 프리웜이 구운 fundamental 평이화가
 * `"현재 주가가 어느 수준인지는 제시된 자료에 명시되어 있지 않지만"`으로
 * 시작했다 — 그 문장이 그대로 검색 스니펫에 실린다. 두 경로가 갈리지 않도록
 * 여기 한 곳에 둔다.
 *
 * **payload에 숫자가 하나라도 있으면 조회하지 않는다.** `technical`은
 * `planCheck.currentPrice`를 이미 담고 있어(실측 74/86) 조회가 순수 낭비다.
 * 이 가드가 없으면 모든 분석이 시세를 한 번씩 더 부른다.
 *
 * 조회 실패는 평이화를 막지 않는다 — 현재가 없이 그대로 진행한다.
 */
export async function resolveCurrentPrice(
    symbol: string,
    payload: unknown
): Promise<number | undefined> {
    if (collectNumbers(withoutDataAsOf(payload)).size > 0) return undefined;
    try {
        const profile = await resolveMarketProfile(symbol);
        const provider = getCachedMarketDataProvider(sessionSpecFor(profile));
        const quote = await quoteWithTimeout(provider, symbol);
        const price = quote?.price;
        return typeof price === 'number' && Number.isFinite(price) && price > 0
            ? price
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * 분석 payload가 스스로 밝힌 마지막 봉 시각(core `dataAsOf.barTime`, 초). 없거나 모양이 다르면 `undefined`.
 * 옛 캐시 항목에는 필드가 없다 — 선택 필드로 읽는다.
 */
function readBarTime(analysis: unknown): unknown {
    if (typeof analysis !== 'object' || analysis === null) return undefined;
    const dataAsOf = (analysis as { dataAsOf?: unknown }).dataAsOf;
    if (typeof dataAsOf !== 'object' || dataAsOf === null) return undefined;
    return (dataAsOf as { barTime?: unknown }).barTime;
}

/** 분석을 만든 시각(core `analyzedAt`, ISO 문자열). 없으면 `undefined`. */
function readAnalyzedAt(analysis: unknown): unknown {
    if (typeof analysis !== 'object' || analysis === null) return undefined;
    return (analysis as { analyzedAt?: unknown }).analyzedAt;
}

/**
 * 평이화 프롬프트에 실을 가격 기준 시점(`facts.asOf`). 이 함수는 절대 throw하지 않는다.
 *
 * `resolveCurrentPrice`와 같은 이유로 SSE 라우트와 프리웜 harvest가 **한 곳에서** 만든다 —
 * 두 경로가 따로 계산하면 같은 분석문이 경로에 따라 다른 기준일로 저장된다.
 *
 * 1순위는 분석이 밝힌 마지막 봉(`analysis.dataAsOf.barTime`, `buildDataAsOfLabel`)이다 —
 * 세션 마감 전에 만든 분석이 마감 뒤에 재사용돼도 가격이 속한 봉의 날짜를 말한다. 없으면
 * (옛 캐시 항목·뉴스 등 필드가 없는 분석) 지금 시장 상태로 고른다(`buildPriceAsOf`).
 * `currentPrice`는 그대로다 — 바뀌는 것은 앵커 문구뿐이다.
 *
 * 시장은 `resolveMarketProfile`로 정한다(크립토는 DB 멤버십이라 형상으로 알 수 없다).
 * 조회가 던지면 한국 종목 여부만 형상으로 가른다 — 크립토가 미국 주식으로 떨어져 "종가"로
 * 읽히는 쪽이 기준 시점이 아예 없는 쪽보다 낫다.
 */
export async function resolvePriceAsOf(
    symbol: string,
    locale: string,
    analysis?: unknown,
    now: Date = new Date()
): Promise<string> {
    let profile: Awaited<ReturnType<typeof resolveMarketProfile>>;
    try {
        profile = await resolveMarketProfile(symbol);
    } catch {
        profile = profileIdForSymbol(symbol);
    }
    const spec = sessionSpecFor(profile);
    return (
        buildDataAsOfLabel(
            spec,
            readBarTime(analysis),
            now,
            locale,
            readAnalyzedAt(analysis)
        ) ?? buildPriceAsOf(spec, now, locale)
    );
}
