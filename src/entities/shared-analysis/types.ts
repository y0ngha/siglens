import type {
    AnalysisResponse,
    OverallAnalysisResponse,
    NewsAnalysisResponse,
    FundamentalAnalysisResponse,
    FinancialsAnalysisResponse,
    CongressTrendResponse,
    OptionsAnalysisResponse,
    FearGreedSnapshot,
    Bar,
    Tier,
} from '@y0ngha/siglens-core';
import type { ShareableKind } from '@/shared/db/constants';

export type { ShareableKind };

/** kind → 그 탭의 분석 결과 타입. */
export interface ShareResultMap {
    chart: AnalysisResponse;
    overall: OverallAnalysisResponse;
    news: NewsAnalysisResponse;
    fundamental: FundamentalAnalysisResponse;
    financials: FinancialsAnalysisResponse;
    congress: CongressTrendResponse;
    options: OptionsAnalysisResponse;
    'fear-greed': FearGreedSnapshot;
}
export type SnapshotResultOf<K extends ShareableKind> = ShareResultMap[K];

/** 스냅샷 표시에 필요한 부가 컨텍스트. */
export interface ShareContext {
    symbol: string;
    displayName: string;
    /** 종목 자산 분류(equity/crypto 등). 위젯이 값을 알 때만 전달; 미지 시 생략. */
    assetClass?: string;
    analyzedAt?: string;
}

/** DB jsonb에 저장되는 스냅샷(직렬화 안전: Date 없음). */
export interface SharedAnalysisSnapshot<
    K extends ShareableKind = ShareableKind,
> {
    kind: K;
    symbol: string;
    context: ShareContext;
    result: SnapshotResultOf<K>;
    /**
     * Snapshot-time candlestick bars — chart kind only.
     * Stored at snapshot level (not inside `result`) so the existing
     * `MAX_RESULT_BYTES` guard on `result` remains unchanged.
     * Capped to `MAX_CHART_BARS` (400) bars by `isValidShareInput`.
     */
    chartBars?: Bar[];
}

/** createShareSnapshotAction 입력(클라 전달). */
export interface CreateShareInput<K extends ShareableKind = ShareableKind> {
    kind: K;
    symbol: string;
    context: ShareContext;
    result: SnapshotResultOf<K>;
    sharerTier: Tier;
    /**
     * Snapshot-time OHLCV bars to embed in the chart share snapshot.
     * Only valid (and only sent) when `kind === 'chart'`.
     * Validated server-side: must be an array with length ≤ MAX_CHART_BARS.
     */
    chartBars?: Bar[];
}

/** 액션 결과. */
export type CreateShareResult =
    | { ok: true; id: string }
    | { ok: false; code: 'invalid_input' | 'rate_limited' | 'persist_failed' };

/** /share 조회 결과. */
export type SharedAnalysisLookup =
    | { status: 'found'; snapshot: SharedAnalysisSnapshot; createdAt: string }
    | { status: 'expired' }
    | { status: 'not_found' };
