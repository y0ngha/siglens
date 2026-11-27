import type {
    Bar,
    ChartOverlay,
    PatternResult,
    StrategyResult,
    Timeframe,
} from '@y0ngha/siglens-core';
import {
    barTimesOf,
    isOverlayAlignedToBars,
    overlayTimes,
} from '@/entities/analysis/lib/overlayAlignment';
import type {
    ChatChartBars,
    ChatChartBlock,
    ChatChartTimeframe,
} from '@/entities/chat-conversation/types';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    isTargetReferenceOnly,
    resolvePatternBaseRate,
} from '@/shared/lib/patternBaseRate';

/** 작도가 없을 때 싣는 최근 봉 수 — 채팅 폭에서 캔들이 읽히는 정도. */
const CHART_BLOCK_BARS = 120;
/**
 * 작도의 가장 이른 시각까지 봉 창을 넓힐 때의 상한. 아주 오래된 시점을 잡는 작도(장기 추세선)가 창을 수천 봉으로 늘려
 * 저장 행이 커지지 않게 한다 — 넘는 작도는 정렬 검사에서 빠진다.
 */
const CHART_BLOCK_MAX_BARS = 400;

/** 차트 블록이 읽는 분석 필드 — `AnalysisResponse`와 티어 필터를 거친 `FilteredAnalysisResponse` 둘 다 맞는다. */
export interface ChartAnalysisSource {
    chartOverlays?: readonly ChartOverlay[];
    patternSummaries?: readonly PatternResult[] | null;
    strategyResults?: readonly StrategyResult[] | null;
    analyzedAt?: string;
}

interface ChartBlockSource {
    symbol: string;
    timeframe: ChatChartTimeframe;
    marketProfile: MarketProfileId;
    bars: readonly Bar[];
}

/**
 * 봉 창: 기본은 최근 {@link CHART_BLOCK_BARS}개, 작도가 있으면 그 가장 이른 시각까지(최대 {@link CHART_BLOCK_MAX_BARS}개).
 */
function windowFor(
    bars: readonly Bar[],
    overlays: readonly ChartOverlay[]
): readonly Bar[] {
    const earliest = Math.min(...overlays.flatMap(overlayTimes));
    const fromEarliest = Number.isFinite(earliest)
        ? bars.findIndex(b => b.time >= earliest)
        : -1;
    const defaultStart = Math.max(0, bars.length - CHART_BLOCK_BARS);
    const capStart = Math.max(0, bars.length - CHART_BLOCK_MAX_BARS);
    const start =
        fromEarliest === -1
            ? defaultStart
            : Math.max(capStart, Math.min(defaultStart, fromEarliest));
    return bars.slice(start);
}

/** 차트가 그리는 봉 필드만 — 공급자 봉의 부가 필드(VWAP 등)는 저장·전송하지 않는다. */
function slimBars(bars: readonly Bar[]): ChatChartBars {
    return bars.map(({ time, open, high, low, close, volume }) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
    }));
}

/**
 * 봉과 (있으면) 분석 작도로 차트 블록을 만든다 — 봉 창에 시각이 모두 들어가는 작도만 싣는다. 작도가 하나도 맞지 않으면
 * 봉만 그린다(빈 작도 목록). 봉이 없으면 `null`.
 *
 * `analysisTimeframe`은 분석의 주기다(블록의 주기는 주봉·월봉도 되지만 분석은 없다). 주면 분석 카드와 같은 판정으로
 * "참고 거리"로 흐리게 그릴 패턴을 `referenceOnlyOverlayKeys`에 싣는다. 안 주면(봉 지표) 필드를 두지 않는다.
 */
export function chartBlockFrom(
    source: ChartBlockSource,
    analysis?: ChartAnalysisSource,
    analysisTimeframe?: Timeframe
): ChatChartBlock | null {
    const overlays: readonly ChartOverlay[] = analysis?.chartOverlays ?? [];
    const bars = windowFor(source.bars, overlays);
    if (bars.length === 0) return null;
    const times = barTimesOf(bars);
    return {
        version: 1,
        symbol: source.symbol,
        timeframe: source.timeframe,
        marketProfile: source.marketProfile,
        bars: slimBars(bars),
        overlays: overlays.filter(o => isOverlayAlignedToBars(o, times)),
        overlayColors: Object.fromEntries(
            (analysis?.patternSummaries ?? []).flatMap(p =>
                p.renderConfig?.color ? [[p.id, p.renderConfig.color]] : []
            )
        ),
        overlayLabels: Object.fromEntries([
            ...(analysis?.patternSummaries ?? []).map(p => [p.id, p.skillName]),
            ...(analysis?.strategyResults ?? []).map(r => [
                r.id,
                r.strategyName,
            ]),
        ]),
        analyzedAt: analysis?.analyzedAt ?? null,
        ...(analysis !== undefined && analysisTimeframe !== undefined
            ? {
                  referenceOnlyOverlayKeys: referenceOnlyKeysOf(
                      analysis.patternSummaries ?? [],
                      analysisTimeframe
                  ),
              }
            : {}),
    };
}

/**
 * 목표선을 "참고 거리"로 흐리게 그릴 패턴의 id. 분석 카드(`PatternsSection`)·종목 페이지 차트(`ChartContent`)와 같은
 * 함수(`resolvePatternBaseRate`·`isTargetReferenceOnly`)로 판정해 세 곳의 선과 문구가 어긋나지 않는다. 오버레이는 이 id를
 * `sourceRef`로 가진다.
 */
function referenceOnlyKeysOf(
    patterns: readonly PatternResult[],
    timeframe: Timeframe
): string[] {
    return patterns
        .filter(p =>
            isTargetReferenceOnly(resolvePatternBaseRate(p, timeframe))
        )
        .map(p => p.id);
}
