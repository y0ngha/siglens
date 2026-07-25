import type {
    FundamentalCategory,
    FundamentalSentiment,
} from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';

interface FundamentalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmFundamental`(→`submitFundamentalAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: FundamentalAnalysisResponse`를
     * 그대로 저장, `src/entities/analysis/lib/prewarmSubmits.ts`). 여기서 다시
     * 방어적으로 좁힌다.
     *
     * `OverallSnapshotProse`와 같은 이유로 이 값은 core `filterAnalysisResult`
     * (technical 전용 info-depth 필드 마스킹)의 대상이 아니다 — fundamental
     * submit 경로(`submitFundamentalAnalysis.js`)는 `tier`를 BYOK 게이트·
     * usage 한도·스킬 샘플링·캐시 키에만 사용하고, 응답 필드 자체를 tier로
     * 마스킹하는 코드 경로가 없다. free tier로 pre-warm해도 전 필드가 그대로
     * 채워진다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
}

const SENTIMENT_LABEL: Record<FundamentalSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

function isSentiment(value: unknown): value is FundamentalSentiment {
    return typeof value === 'string' && value in SENTIMENT_LABEL;
}

const CATEGORY_LABEL: Record<FundamentalCategory, string> = {
    valuation: '밸류에이션',
    profitability: '수익성',
    growth: '성장성',
    health: '재무 건전성',
    futureDirection: '미래 방향',
};

function isCategory(value: unknown): value is FundamentalCategory {
    return typeof value === 'string' && value in CATEGORY_LABEL;
}

interface NarrowedCategoryAssessment {
    category: FundamentalCategory;
    sentiment: FundamentalSentiment | null;
    rationaleKo: string;
}

function narrowCategoryAssessment(
    value: unknown
): NarrowedCategoryAssessment | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!isCategory(record.category)) return null;

    return {
        category: record.category,
        sentiment: isSentiment(record.sentiment) ? record.sentiment : null,
        rationaleKo:
            typeof record.rationaleKo === 'string' ? record.rationaleKo : '',
    };
}

interface NarrowedFundamentalContent {
    overallConclusionKo: string;
    overallSentiment: FundamentalSentiment | null;
    categoryAssessments: NarrowedCategoryAssessment[];
    riskFactorsKo: string[];
}

/**
 * `content`를 fundamental 결과 모양으로 좁힌다.
 *
 * `overallConclusionKo`(종합 결론), `categoryAssessments`(카테고리별 평가,
 * 각 `rationaleKo`를 동반), `riskFactorsKo`(위험 요인)가 프로즈 소스다. 이
 * 응답은 (overall과 마찬가지로) tier 마스킹을 거치지 않으므로 네 필드
 * 전부 값이 채워질 수 있다.
 */
function narrowFundamentalContent(
    content: unknown
): NarrowedFundamentalContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const overallConclusionKo =
        typeof record.overallConclusionKo === 'string'
            ? record.overallConclusionKo.trim()
            : '';
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const categoryAssessments = Array.isArray(record.categoryAssessments)
        ? record.categoryAssessments
              .map(narrowCategoryAssessment)
              .filter(a => a !== null)
        : [];

    const riskFactorsKo = Array.isArray(record.riskFactorsKo)
        ? record.riskFactorsKo.filter(
              (item): item is string => typeof item === 'string'
          )
        : [];

    if (
        overallConclusionKo.length === 0 &&
        categoryAssessments.length === 0 &&
        riskFactorsKo.length === 0
    ) {
        return null;
    }

    return {
        overallConclusionKo,
        overallSentiment,
        categoryAssessments,
        riskFactorsKo,
    };
}

/**
 * SEO pre-warm 스냅샷의 fundamental 탭 프로즈 렌더러 —
 * `TechnicalSnapshotProse`/`OverallSnapshotProse`가 세운 패턴(spec
 * 2026-07-24 Task 4~5)을 따르는 세 번째 탭 렌더러(Task 6). `overallConclusionKo`를
 * 문단으로(`\n` 기준 분리), `overallSentiment`가 있으면 리드 문구로,
 * `categoryAssessments`를 카테고리 라벨 붙은 목록으로, `riskFactorsKo`를
 * 위험 요인 목록으로 렌더한다.
 *
 * 네 프로즈 소스 중 단 하나도 값이 없으면 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function FundamentalSnapshotProse({
    content,
    symbol,
    displayName,
}: FundamentalSnapshotProseProps) {
    const narrowed = narrowFundamentalContent(content);
    if (narrowed === null) return null;

    const conclusionParagraphs = narrowed.overallConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection displayName={displayName}>
            <div className="text-secondary-300 space-y-4 text-sm leading-6">
                {narrowed.overallSentiment !== null && (
                    <p className="text-secondary-200 font-medium">
                        {symbol} 펀더멘털 종합 평가:{' '}
                        {SENTIMENT_LABEL[narrowed.overallSentiment]}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map(line => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                )}

                {narrowed.categoryAssessments.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            카테고리별 평가
                        </h3>
                        <ul
                            aria-label={`${symbol} 카테고리별 평가 목록`}
                            className="space-y-2"
                        >
                            {narrowed.categoryAssessments.map(a => (
                                <li key={a.category}>
                                    <span className="text-secondary-200 font-medium">
                                        {CATEGORY_LABEL[a.category]}
                                        {a.sentiment !== null &&
                                            ` (${SENTIMENT_LABEL[a.sentiment]})`}
                                    </span>
                                    {a.rationaleKo.length > 0 && (
                                        <p>{a.rationaleKo}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {narrowed.riskFactorsKo.length > 0 && (
                    <div>
                        <h3 className="text-secondary-100 mb-1.5 text-sm font-semibold">
                            위험 요인
                        </h3>
                        <ul
                            aria-label={`${symbol} 위험 요인 목록`}
                            className="space-y-1"
                        >
                            {narrowed.riskFactorsKo.map((risk, i) => (
                                <li
                                    key={`risk-${i}-${risk}`}
                                    className="flex gap-2"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="mt-0.5 shrink-0"
                                    >
                                        •
                                    </span>
                                    {risk}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SnapshotSummarySection>
    );
}
