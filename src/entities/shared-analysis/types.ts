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
 * chart 공유 스냅샷에 실리는 캔들 수 상한(`isValidShareInput`이 강제).
 *
 * jsonb 컬럼 크기 제한이 아니라 `chartBars`의 개수 상한이다. `result`의 크기 제약은
 * `server/assertValidInput.ts`의 MAX_RESULT_BYTES(65,536 UTF-8 바이트)다.
 *
 * 크기 근거(최악):
 *   - 가장 큰 정상 AnalysisResponse(한국어, 시그널 50개, 핵심 가격대 40개): 약 20 KB
 *   - 400봉 x 봉당 약 101바이트(JSON): 약 40 KB
 *   - 합계 약 60 KB — MAX_RESULT_BYTES 아래다.
 *
 * core의 1Day `TIMEFRAME_BARS_LIMIT`가 500이라 여유를 두고 400으로 자른다.
 * ChartContent가 전송 전에 마지막 MAX_CHART_BARS개로 자른다(분석에 가장 관련 있는 최근 캔들).
 *
 * `ShareButton`('use client')이 서버 전용 코드를 끌어오지 않고 import하도록
 * server/assertValidInput.ts가 아닌 이 클라이언트 안전 모듈에 둔다.
 */
export const MAX_CHART_BARS = 400;

export type { ShareableKind };

/** kind → 그 탭의 분석 결과 타입. */
interface ShareResultMap {
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
     * 스냅샷 시점의 캔들 — chart kind 전용.
     * `result` 안이 아닌 스냅샷 최상위에 두어 `result`의 `MAX_RESULT_BYTES` 검사를
     * 그대로 유지한다. 개수는 `isValidShareInput`이 `MAX_CHART_BARS`로 제한한다.
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
     * 공유한 사용자의 티어. `shared_analyses.sharer_tier`에 저장된다.
     *
     * 현재 읽기 경로(getSharedAnalysisAction / ShareKindPanel / 공유 페이지)는 쓰지 않는다.
     * 뷰어 쪽 티어별 필드 마스킹(무료 공유자의 프리미엄 필드 블러 등)을 위한 저렴한
     * 메타데이터로 남겨 둔다 — 컬럼을 지웠다 다시 추가하는 것이 더 큰 변경이다.
     */
    sharerTier: Tier;
    /**
     * chart 공유 스냅샷에 넣을 스냅샷 시점 OHLCV 캔들. `kind === 'chart'`일 때만
     * 유효하며 서버가 배열이고 길이가 MAX_CHART_BARS 이하인지 검증한다.
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
