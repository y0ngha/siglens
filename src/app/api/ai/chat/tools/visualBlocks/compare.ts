import 'server-only';
import {
    closeOnOrBefore,
    minusCalendarMonths,
    type Bar,
} from '@y0ngha/siglens-core';
import { lastBarIsForming } from '@/entities/bars/lib/quantizeBars';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import type {
    ChatCompareBlock,
    ChatCompareChartPeriod,
} from '@/entities/chat-conversation/types';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { barDate } from '../calendarChange';
import { staleKrListingDate } from '../freshness';
import { logToolDegrade } from '../logToolDegrade';
import { resolveAssetInfoOrNull } from '../resolveAssetInfo';
import { downsample, roundTo } from './round';
import { noData, type VisualBuildEnv, type VisualOutcome } from './types';

/** 종목당 선 점 수 상한 — 1년 일봉(~252)이 그대로 들어가고, 블록이 5종목에서도 50KB 안에 든다. */
export const COMPARE_POINTS_MAX = 260;
export const COMPARE_DEFAULT_PERIOD: ChatCompareChartPeriod = '6M';

const PERIOD_MONTHS: Record<ChatCompareChartPeriod, number> = {
    '1M': 1,
    '3M': 3,
    '6M': 6,
    '1Y': 12,
};

interface CompareSeries {
    symbol: string;
    points: [number, number][];
}

/**
 * 일봉에서 비교 선 하나를 만든다. 기준은 기간 시작일 **당일 또는 그 직전 세션**의 종가이고 점은 `[봉 시각, 기준 대비 %]`다.
 * 기간 시작일은 그 종목의 마지막 봉 날짜에서 `months`달력월을 뺀 날(말일 보정)이다 — `get_price_stats`·`get_bars_indicators`의
 * `calendarChange`와 같은 core 규칙(`minusCalendarMonths` + `closeOnOrBefore`)이라 같은 기간의 수익률이 도구마다 갈리지 않는다.
 * 이력이 시작일까지 거슬러 가지 않으면 첫 봉이 기준이다. 종가가 유효하지 않은 봉은 건너뛰고, 쓸 봉이 없으면 `null`이다.
 */
export function compareSeriesFrom(
    symbol: string,
    bars: readonly Bar[],
    months: number
): CompareSeries | null {
    const usable = bars.filter(b => Number.isFinite(b.close) && b.close > 0);
    const last = usable.at(-1);
    if (last === undefined) return null;
    const baseIndex = Math.max(
        0,
        closeOnOrBefore(
            usable.map(b => ({ date: barDate(b), close: b.close })),
            minusCalendarMonths(barDate(last), months)
        )
    );
    const window = usable.slice(baseIndex);
    const base = window[0];
    if (base === undefined) return null;
    const points = window.map((b): [number, number] => [
        b.time,
        roundTo((b.close / base.close - 1) * 100, 2),
    ]);
    return { symbol, points: downsample(points, COMPARE_POINTS_MAX) };
}

async function loadDailyBars(
    symbol: string,
    now: Date
): Promise<readonly Bar[] | null> {
    try {
        // 시장 프로필은 이미 받는 자산 정보에서 정한다 — 따로 `resolveMarketProfile`을 부르면 자산 조회가 던질 때
        // (모르는 종목·FMP 장애) 그 종목 전체가 빠져, 두 종목 비교가 한 종목으로 줄어 그림이 사라졌다.
        const asset = await resolveAssetInfoOrNull(symbol, 'show_chart');
        const profile = marketProfileForAssetInfo(asset);
        const session = sessionSpecFor(profile);
        const { bars: loaded } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            '1Day',
            asset?.fmpSymbol,
            session
        );
        // 마감된 세션만 쓴다 — 장중에는 마지막 봉이 형성 중이라 그 종가는 현재가이지 종가가 아니다.
        const bars = lastBarIsForming(loaded, session, now)
            ? loaded.slice(0, -1)
            : loaded;
        const last = bars.at(-1);
        if (last === undefined) return null;
        // 한국의 죽은 리스팅은 묵은 봉을 수익률로 내보내지 않는다.
        return staleKrListingDate(
            profile,
            last.time * MS_PER_SECOND,
            Date.now()
        ) === null
            ? bars
            : null;
    } catch (error) {
        logToolDegrade('show_chart', 'compare bars', error);
        return null;
    }
}

/** 종목 수익률 비교 — 읽지 못한 종목은 빼고 2개 이상 남을 때만 그린다. */
export async function buildCompareBlock(
    symbols: readonly string[],
    period: ChatCompareChartPeriod,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    // E2E fake 공급자의 봉은 고정된 과거 3개뿐이라 기간 시작일 이전 봉이 없다 — 그때는 첫 봉이 기준이라 그 봉 전부를 그린다.
    const months = PERIOD_MONTHS[period];
    const loaded = await Promise.all(
        symbols.map(async symbol => {
            const bars = await loadDailyBars(symbol, env.now);
            return bars === null
                ? null
                : compareSeriesFrom(symbol, bars, months);
        })
    );
    const series = loaded.filter((s): s is CompareSeries => s !== null);
    if (series.length < 2) return noData('not_enough_symbols_with_data');
    const block: ChatCompareBlock = {
        version: 1,
        kind: 'compare',
        asOf: env.now.toISOString(),
        period,
        series,
    };
    const dateOf = (seconds: number): string =>
        toUtcIsoDate(new Date(seconds * MS_PER_SECOND));
    return {
        block,
        summary: {
            period,
            note: 'returnPct is the % change of the close from the base session: the last session on or before the period start (the last session date minus the period; the first session when the history starts later). from is that base date.',
            series: series.flatMap(s => {
                const first = s.points.at(0);
                const last = s.points.at(-1);
                return first === undefined || last === undefined
                    ? []
                    : [
                          {
                              symbol: s.symbol,
                              from: dateOf(first[0]),
                              to: dateOf(last[0]),
                              returnPct: last[1],
                          },
                      ];
            }),
            missing: symbols.filter(
                symbol => !series.some(s => s.symbol === symbol)
            ),
        },
    };
}
