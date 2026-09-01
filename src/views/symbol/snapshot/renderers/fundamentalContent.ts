import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

import type {
    FundamentalCategory,
    FundamentalSentiment,
} from '@y0ngha/siglens-core';

/** FundamentalSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<FundamentalSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

/** FundamentalCategory → `shared.enumLabel` 카탈로그 키. */
export const CATEGORY_LABEL_KEY: Record<FundamentalCategory, string> = {
    valuation: 'fundamentalCategory.valuation',
    profitability: 'fundamentalCategory.profitability',
    growth: 'fundamentalCategory.growth',
    health: 'fundamentalCategory.health',
    futureDirection: 'fundamentalCategory.futureDirection',
};

const isCategory = createEnumGuard(CATEGORY_LABEL_KEY);

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
export function narrowFundamentalContent(
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
