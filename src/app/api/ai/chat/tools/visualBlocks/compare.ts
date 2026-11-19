import 'server-only';
import type { Bar } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import type {
    ChatCompareBlock,
    ChatCompareChartPeriod,
} from '@/entities/chat-conversation/types';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { MS_PER_SECOND } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
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

/** 기간 시작(UTC 자정, 초) — `now`에서 달력 기준으로 거슬러 올라간다. */
export function compareStartSeconds(
    period: ChatCompareChartPeriod,
    now: Date
): number {
    const targetMonth = now.getUTCMonth() - PERIOD_MONTHS[period];
    // `Date.UTC(y, m, 31)`는 짧은 달에서 다음 달로 넘친다(3/31 − 1개월 → 3/3). 목표 달의 말일로 눌러 준다.
    const lastDayOfTargetMonth = new Date(
        Date.UTC(now.getUTCFullYear(), targetMonth + 1, 0)
    ).getUTCDate();
    const start = Date.UTC(
        now.getUTCFullYear(),
        targetMonth,
        Math.min(now.getUTCDate(), lastDayOfTargetMonth)
    );
    return start / MS_PER_SECOND;
}

interface CompareSeries {
    symbol: string;
    points: [number, number][];
}

/**
 * 일봉에서 비교 선 하나를 만든다. 기준은 기간 시작 **이후 첫 봉**의 종가이고 점은 `[봉 시각, 기준 대비 %]`다.
 * 종가가 유효하지 않은 봉은 건너뛰고, 쓸 봉이 없으면 `null`이다.
 */
export function compareSeriesFrom(
    symbol: string,
    bars: readonly Bar[],
    startSeconds: number
): CompareSeries | null {
    const usable = bars.filter(
        b => b.time >= startSeconds && Number.isFinite(b.close) && b.close > 0
    );
    const base = usable[0];
    if (base === undefined) return null;
    const points = usable.map((b): [number, number] => [
        b.time,
        roundTo((b.close / base.close - 1) * 100, 2),
    ]);
    return { symbol, points: downsample(points, COMPARE_POINTS_MAX) };
}

async function loadDailyBars(symbol: string): Promise<readonly Bar[] | null> {
    try {
        const [profile, asset] = await Promise.all([
            resolveMarketProfile(symbol),
            resolveAssetInfoOrNull(symbol, 'show_chart'),
        ]);
        const session = sessionSpecFor(profile);
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            '1Day',
            asset?.fmpSymbol,
            session
        );
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
    // E2E fake 공급자의 봉은 고정된 과거 3개뿐이라 기간 창에 하나도 안 걸린다 — fake 모드는 창을 걸지 않고 그 봉 전부를 그린다.
    const startSeconds = isE2EFakeMode()
        ? 0
        : compareStartSeconds(period, env.now);
    const loaded = await Promise.all(
        symbols.map(async symbol => {
            const bars = await loadDailyBars(symbol);
            return bars === null
                ? null
                : compareSeriesFrom(symbol, bars, startSeconds);
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
            note: 'returnPct is the % change of the close from the first session on or after the period start',
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
