import 'server-only';
import {
    peekAnalysisCache,
    TIER_CONFIG,
    type TierConfig,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import type { ChatChartBlock } from '@/entities/chat-conversation/types';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import {
    chartBlockFrom,
    type ChartAnalysisSource,
} from '@/features/agent-tools/lib/chartBlock';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { withTimeout } from '@/shared/lib/withTimeout';

/**
 * 차트 블록 하나를 기다리는 상한. 블록은 도구가 끝난 뒤(core의 도구 시간 상한 밖에서) 만들어지고 턴은 저장·`done` 전에
 * 블록을 모두 기다리므로, 봉 조회가 멈추면 끝난 답변까지 붙잡힌다 — 넘으면 차트 없이 간다(`null`).
 */
const CHART_BLOCK_TIMEOUT_MS = 8_000;

/**
 * 차트용으로만 쓰는 티어 설정: 정보 깊이 제한을 끈다. 모델이 읽는 분석은 원래 `TIER_CONFIG`로 걸러 티어 정책을 그대로
 * 지키고, 그림에는 분석이 그은 작도(차트 패턴·추세선·되돌림)를 티어와 무관하게 모두 싣는다 — 게스트·무료 등급도 같은
 * 차트를 본다(제품 결정 2026-11-17). 분석 캐시에는 필터 전 전체 결과가 있고 필터는 꺼낼 때 적용된다(core `peekAnalysisCache`).
 */
const CHART_DRAWINGS_TIER_CONFIG: TierConfig = {
    ...TIER_CONFIG,
    featureFlags: {
        ...TIER_CONFIG.featureFlags,
        enableInfoDepthRestrictions: false,
    },
};

/** 원래 peek과 같은 캐시 키를 만드는 인자 — 차트용 재조회가 다른 항목을 읽지 않도록 그대로 넘긴다. */
type PeekArgs = Parameters<typeof peekAnalysisCache>;
interface ChartPeekKey {
    symbol: string;
    timeframe: Timeframe;
    modelId: PeekArgs[3];
    reasoning: boolean;
    tier: PeekArgs[5];
    positionBucket: PeekArgs[7];
    locale: PeekArgs[8];
    /** 쓴 쪽 `benchmark.symbol` — core 캐시 키(`:bm=`)에 접히므로 어긋나면 미스다. */
    benchmarkSymbol: string | undefined;
}

/**
 * 모델이 받은 분석과 **같은 캐시 항목**을 작도 제한 없이({@link CHART_DRAWINGS_TIER_CONFIG}) 다시 꺼낸다. 원래 peek과 같은
 * 키로 읽고, 꺼낸 분석의 `analyzedAt`이 받은 분석과 같을 때만 쓴다 — 그 사이 새 생성이 포인터를 바꿨다면(같은 턴의 새 분석
 * 등) 다른 분석의 작도가 답변 옆에 붙지 않게 받은 분석으로 돌아간다. 못 꺼내도 받은 분석이다.
 */
export async function peekChartDrawings(
    key: ChartPeekKey,
    received: ChartAnalysisSource
): Promise<ChartAnalysisSource> {
    const hit = await peekAnalysisCache(
        key.symbol,
        key.timeframe,
        undefined,
        key.modelId,
        key.reasoning,
        key.tier,
        CHART_DRAWINGS_TIER_CONFIG,
        key.positionBucket,
        key.locale,
        { benchmarkSymbol: key.benchmarkSymbol }
    );
    return hit !== null && hit.result.analyzedAt === received.analyzedAt
        ? hit.result
        : received;
}

interface AnalysisChartInput {
    symbol: string;
    timeframe: Timeframe;
    fmpSymbol: string | undefined;
    /**
     * 작도를 가져올 분석 — 새로 생성한 분석이면 core의 필터 전 결과(`unfilteredResult`), 캐시 적중이면
     * {@link peekChartDrawings}로 다시 꺼낸 전체 작도(못 꺼내면 모델이 받은 분석).
     */
    loadAnalysis: () => Promise<ChartAnalysisSource>;
}

async function buildAnalysisChartBlock(
    input: AnalysisChartInput
): Promise<ChatChartBlock | null> {
    const [marketProfile, analysis] = await Promise.all([
        resolveMarketProfile(input.symbol),
        input.loadAnalysis(),
    ]);
    const session = sessionSpecFor(marketProfile);
    const { bars } = await getCachedBarsWithIndicators(
        getCachedMarketDataProvider(session),
        input.symbol,
        input.timeframe,
        input.fmpSymbol,
        session
    );
    return chartBlockFrom(
        {
            symbol: input.symbol,
            timeframe: input.timeframe,
            marketProfile,
            bars,
        },
        analysis,
        input.timeframe
    );
}

/**
 * 기술 분석의 차트 블록 — 분석과 같은 심볼·주기의 봉을 캐시 경로(`getCachedBarsWithIndicators`, 분석·종목 페이지가 쓰는
 * 같은 키)로 읽는다. 봉이 없거나, 봉 조회·시장 판정이 실패하거나, {@link CHART_BLOCK_TIMEOUT_MS}를 넘으면 `null`이다(차트는
 * 부가 표시라 도구 결과를 바꾸지 않는다). 절대 던지지 않는다.
 */
export function loadAnalysisChartBlock(
    input: AnalysisChartInput
): Promise<ChatChartBlock | null> {
    return withTimeout(
        buildAnalysisChartBlock(input).catch((error: unknown) => {
            logToolDegrade('chart block', 'analysis chart', error);
            return null;
        }),
        CHART_BLOCK_TIMEOUT_MS,
        null
    );
}
