import 'server-only';
import {
    classifyTrend,
    evaluateConfluence,
    evaluatePullback,
    type BarsData,
} from '@y0ngha/siglens-core';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { buildSignalBrief } from '@/entities/email-report/lib/buildSignalBrief';
import type { SymbolBrief } from '@/entities/email-report/reportModel';

/** 종목 한 칸의 경량 데이터를 채우는 읽기 소스. 테스트가 갈아 끼울 수 있게 주입받는다. */
export interface SymbolBriefSources {
    getDailyBars: (symbol: string) => Promise<BarsData>;
}

/**
 * 운영 소스 — 차트 라우트(`/api/email-report/chart`)와 같은 `loadBarsData(symbol, '1Day')`.
 * 시장 프로필을 풀어 세션에 맞는 캐시 provider(`getCachedMarketDataProvider`)로 받으므로
 * 종목 페이지와 세션 롤 키를 공유해 보통 캐시 적중이다.
 */
export function createSymbolBriefSources(): SymbolBriefSources {
    return { getDailyBars: symbol => loadBarsData(symbol, '1Day') };
}

function noData(symbol: string): SymbolBrief {
    return {
        symbol,
        close: null,
        changePercent: null,
        trend: null,
        signals: null,
    };
}

async function fetchBars(
    symbol: string,
    sources: SymbolBriefSources
): Promise<BarsData | null> {
    try {
        return await sources.getDailyBars(symbol);
    } catch (error) {
        console.warn(
            `[email-report] daily bars unavailable for ${symbol}`,
            error
        );
        return null;
    }
}

/**
 * 요약 표 한 행(과 카드의 신호 줄)에 필요한 것만 모은다 — 일봉 한 번. 스냅샷·뉴스·옵션은
 * 읽지 않는다. 실패는 그 종목 행만 "데이터 없음"으로 두고 메일은 나간다
 * (`loadSymbolReport`의 `settle`과 같은 태도).
 *
 * 판정은 전부 core다: `classifyTrend`, `evaluateConfluence`(HTF 게이트 없음 — `htfBars`
 * 미전달, 측정이 뒷받침하지 않는 옵션을 메일에 들이지 않는다), `evaluatePullback`.
 * `CONFLUENCE_MIN_BARS` 미만이면 core가 `null`을 돌려주고 점수는 `null`(보류)로 남는다.
 */
export async function loadSymbolBrief(
    symbol: string,
    sources: SymbolBriefSources
): Promise<SymbolBrief> {
    const data = await fetchBars(symbol, sources);
    if (data === null) return noData(symbol);
    try {
        return computeBrief(symbol, data);
    } catch (error) {
        // core가 이상한 봉에서 던져도 그 종목 행만 "데이터 없음"으로 둔다 — 한 종목이
        // 수신자의 메일 전체를 막지 않게 한다.
        console.error(
            `[email-report] brief computation failed for ${symbol}`,
            error
        );
        return noData(symbol);
    }
}

function computeBrief(symbol: string, data: BarsData): SymbolBrief {
    const { bars, indicators } = data;
    const last = bars.at(-1);
    if (last === undefined) return noData(symbol);
    const prev = bars.at(-2);
    const changePercent =
        prev !== undefined && prev.close > 0
            ? ((last.close - prev.close) / prev.close) * 100
            : null;
    return {
        symbol,
        close: last.close,
        changePercent,
        trend: classifyTrend(bars, indicators),
        signals: buildSignalBrief({
            confluence: evaluateConfluence(bars, { timeframe: '1Day' }),
            pullback: evaluatePullback(bars),
        }),
    };
}
