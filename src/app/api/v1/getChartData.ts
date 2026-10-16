import 'server-only';
import {
    getAllowedTimeframes,
    isTimeframeAllowed,
    type Timeframe,
    type ToolExecutionContext,
} from '@y0ngha/siglens-core';
import { resolveAssetInfoOrNull } from '@/app/api/ai/chat/tools/resolveAssetInfo';
import { getCachedBarsWithIndicators } from '@/entities/bars/lib/barsDataCache';
import { buildChartData } from '@/entities/bars/lib/buildChartData';
import { resolveChartDataIndicators } from '@/entities/bars/lib/chartDataIndicators';
import { roundIndicators } from '@/entities/bars/lib/roundIndicators';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { MS_PER_SECOND } from '@/shared/config/time';
import { PUBLIC_API_CHART_DATA } from '@/shared/config/publicApi';

const { tool, defaultBars, minBars, maxBars, maxResponseChars } =
    PUBLIC_API_CHART_DATA;

/** 응답 `data.meta.source`. `get_bars_indicators`와 같은 문구다. */
export const CHART_DATA_SOURCE = 'SIGLENS bars + indicators';

function requestedBars(value: unknown): number {
    // 스키마 검증(`validateArgs`)이 이미 정수·범위를 보장하지만, 이 함수는 단독으로도 안전해야 한다.
    if (typeof value !== 'number' || !Number.isFinite(value))
        return defaultBars;
    return Math.min(maxBars, Math.max(minBars, Math.trunc(value)));
}

/**
 * `get_chart_data`: 웹 차트·`get_bars_indicators`와 **같은** 캐시 경로(`getCachedBarsWithIndicators`)에서
 * 봉과 지표를 읽어 마지막 N개를 시계열로 돌려준다. 새 FMP 호출도 새 계산도 없다 — 지표는 전체 룩백으로
 * 이미 계산돼 있고, 웹이 쓰는 `roundIndicators`로 반올림한 값을 자르기만 한다.
 *
 * 허용 timeframe은 웹(`getBarsAction`)과 같은 규칙(`isTimeframeAllowed`)을 호출자 tier에 적용한다.
 * 도메인 오류는 던지지 않고 `{ error }`로 돌려준다(`executePublicTool`이 HTTP로 옮긴다).
 */
export async function getChartDataTool(
    args: Record<string, unknown>,
    ctx: Pick<ToolExecutionContext, 'tier'>,
    limit: number = maxResponseChars
): Promise<unknown> {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as Timeframe;
    if (!isTimeframeAllowed(ctx.tier, timeframe))
        return {
            error: 'timeframe_not_allowed',
            tier: ctx.tier,
            timeframe,
            allowedTimeframes: getAllowedTimeframes(ctx.tier),
        };

    const count = requestedBars(args.bars);
    const selected = resolveChartDataIndicators(args.indicators);
    const [profile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, tool),
    ]);
    const session = sessionSpecFor(profile);
    const { bars, indicators } = await getCachedBarsWithIndicators(
        getCachedMarketDataProvider(session),
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session
    );
    const lastBar = bars[bars.length - 1];
    if (lastBar === undefined)
        return { error: 'bars_not_found', symbol, timeframe };

    // 웹(`loadBarsData`)과 같은 반올림을 전체 구간에 적용한 뒤 자른다.
    const rounded = roundIndicators(indicators);
    const descriptor = getDescriptor(profile);
    const build = (barCount: number) =>
        buildChartData({
            symbol,
            timeframe,
            bars,
            indicators: rounded,
            count: barCount,
            selected,
        });
    const meta = {
        source: CHART_DATA_SOURCE,
        asOf: new Date(lastBar.time * MS_PER_SECOND).toISOString(),
        lastBarTime: lastBar.time,
        currency: descriptor.priceFormat.currency,
        quoteDelayMinutes: descriptor.quoteDelayMinutes,
        delayed: descriptor.quoteDelayMinutes > 0,
    };

    let data = build(count);
    let length = JSON.stringify(data).length;
    let limited = false;
    // 안전망: 숫자가 유난히 긴 자산에서 상한을 넘으면 오래된 봉부터 줄인다(최신 봉을 남긴다).
    // 비례 추정이라 한 번에 안 맞을 수 있어 몇 번 더 줄인다.
    for (
        let attempt = 0;
        length > limit && data.bars > 1 && attempt < 8;
        attempt++
    ) {
        limited = true;
        const next = Math.max(1, Math.floor((data.bars * limit) / length) - 1);
        data = build(Math.min(next, data.bars - 1));
        length = JSON.stringify(data).length;
    }
    return {
        ...data,
        meta: { ...meta, barsRequested: count, barsLimitedBySize: limited },
    };
}
