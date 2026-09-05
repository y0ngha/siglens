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

/**
 * Maximum number of candlestick bars stored in a chart share snapshot.
 *
 * This is a COUNT cap on `chartBars` (enforced by `isValidShareInput`), not a
 * jsonb column size limit. The actual size constraint on the `result` field is
 * MAX_RESULT_BYTES (65 536 UTF-8 bytes), defined in server/assertValidInput.ts.
 *
 * Size reasoning (worst case):
 *   - Largest legitimate AnalysisResponse (Korean text, 50 signals, 40 key levels): ~20 KB
 *   - 400 bars × ~101 bytes/bar (JSON): ~40 KB
 *   - Combined: ~60 KB — comfortably under MAX_RESULT_BYTES.
 *
 * Core's TIMEFRAME_BARS_LIMIT for 1Day is 500; we cap at 400 to leave a
 * comfortable safety margin. ChartContent slices to the last MAX_CHART_BARS
 * before sending (most recent candles are most relevant for the analysis).
 *
 * Declared here (client-safe module) rather than in server/assertValidInput.ts
 * so ShareButton ('use client') can import it without pulling in server-only code.
 */
export const MAX_CHART_BARS = 400;

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
    /**
     * 스냅샷 시점의 쉽게보기 산문.
     *
     * 공유 링크를 여는 사람은 SSE 라우트를 타지 않으므로 평이화를 다시 만들 방법이
     * 없다(LLM 재호출은 비용·비결정성 둘 다 문제다). 그래서 공유하는 쪽이 이미
     * 화면에 갖고 있던 산문을 그대로 실어 보낸다.
     *
     * 공유자 로케일로 쓰인 글이다. 공유 URL이 로케일을 보존하므로(`useShareFlow`)
     * 링크를 그대로 연 사람은 같은 언어를 본다. `result` 안의 산문도 같은 성질이라
     * 새로 생기는 제약은 아니다.
     *
     * 없으면(이 필드 추가 이전 스냅샷·평이화 실패) 뷰어는 원문만 본다.
     */
    plain?: string;
}

/** createShareSnapshotAction 입력(클라 전달). */
export interface CreateShareInput<K extends ShareableKind = ShareableKind> {
    kind: K;
    symbol: string;
    context: ShareContext;
    result: SnapshotResultOf<K>;
    /**
     * Tier of the user who created the share, persisted to `shared_analyses.sharer_tier`.
     *
     * Not consumed on the current read path (getSharedAnalysisAction / ShareKindPanel / share page).
     * Stored intentionally as cheap metadata for a documented follow-up: tier-based field masking
     * on the viewer side (spec §12 — e.g. blurring premium fields for free-tier sharers).
     * Removing and re-adding a DB column later would be churn, so this is kept in place.
     */
    sharerTier: Tier;
    /**
     * Snapshot-time OHLCV bars to embed in the chart share snapshot.
     * Only valid (and only sent) when `kind === 'chart'`.
     * Validated server-side: must be an array with length ≤ MAX_CHART_BARS.
     */
    chartBars?: Bar[];
    /**
     * 공유 시점에 화면에 있던 쉽게보기 산문. 없으면 생략한다.
     * 서버가 길이만 검증하고 내용은 신뢰하지 않는다(표시 전용 텍스트).
     */
    plain?: string;
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
