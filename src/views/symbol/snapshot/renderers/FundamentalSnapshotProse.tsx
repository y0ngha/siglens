import type {
    FundamentalCategory,
    FundamentalSentiment,
} from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

interface FundamentalSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 core `prewarmFundamental`(→`submitFundamentalAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: FundamentalAnalysisResponse`를
     * 그대로 저장, `src/entities/analysis/api.ts`). 여기서 다시
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
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
}

const SENTIMENT_LABEL: Record<FundamentalSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL);

const CATEGORY_LABEL: Record<FundamentalCategory, string> = {
    valuation: '밸류에이션',
    profitability: '수익성',
    growth: '성장성',
    health: '재무 건전성',
    futureDirection: '미래 방향',
};

const isCategory = createEnumGuard(CATEGORY_LABEL);

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
            typeof record.rationaleKo === 'string'
                ? stripSnapshotMarkdown(record.rationaleKo).trim()
                : '',
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
            ? stripSnapshotMarkdown(record.overallConclusionKo).trim()
            : '';
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const categoryAssessments = Array.isArray(record.categoryAssessments)
        ? record.categoryAssessments
              .map(narrowCategoryAssessment)
              .filter(a => a !== null)
        : [];

    const riskFactorsKo = narrowStringArray(record.riskFactorsKo);

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
 * `fundamental/page.tsx`가 `<FundamentalSnapshotProse>`를 렌더할지 아니면
 * 클라이언트 AI 위젯(`FundamentalAiSummary`)을 렌더할지 판단하는
 * 예측기(audit fix FIX 2 — `OverallSnapshotProse.hasOverallProse` 패턴). 두
 * 소스가 같은 필드(overallConclusionKo/categoryAssessments/riskFactorsKo)를
 * 같은 순서로 중복 렌더하던 문제를 XOR 게이팅으로 해소한다.
 *
 * `narrowFundamentalContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로
 * 다른 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasFundamentalProse(content: unknown): boolean {
    return narrowFundamentalContent(content) !== null;
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
    generatedAt,
}: FundamentalSnapshotProseProps) {
    const narrowed = narrowFundamentalContent(content);
    if (narrowed === null) return null;

    const conclusionParagraphs = narrowed.overallConclusionKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title="펀더멘털 종합 평가"
            displayName={displayName}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.overallSentiment !== null && (
                    <p className="font-medium text-secondary-200">
                        {symbol} 펀더멘털 종합 평가:{' '}
                        {SENTIMENT_LABEL[narrowed.overallSentiment]}
                    </p>
                )}

                {conclusionParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {conclusionParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                {narrowed.categoryAssessments.length > 0 && (
                    <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                            카테고리별 평가
                        </h3>
                        <ul
                            role="list"
                            aria-label={`${symbol} 카테고리별 평가 목록`}
                            className="space-y-2"
                        >
                            {narrowed.categoryAssessments.map((a, i) => (
                                <li key={`${a.category}-${i}`}>
                                    <span className="font-medium text-secondary-200">
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

                <SnapshotBulletList
                    title="위험 요인"
                    symbol={symbol}
                    ariaSuffix="위험 요인"
                    items={narrowed.riskFactorsKo}
                    keyPrefix="risk"
                />
            </div>
        </SnapshotSummarySection>
    );
}
