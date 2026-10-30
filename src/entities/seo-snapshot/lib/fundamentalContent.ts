import type {
    FundamentalCategory,
    FundamentalSentiment,
} from '@y0ngha/siglens-core';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';
import { narrowStringArray } from './narrowStringArray';

/** FundamentalSentiment → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<FundamentalSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
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
    const record = asRecord(value);
    if (record === null) return null;
    if (!isCategory(record.category)) return null;

    return {
        category: record.category,
        sentiment: isSentiment(record.sentiment) ? record.sentiment : null,
        rationaleKo: narrowCleanString(record.rationaleKo),
    };
}

interface NarrowedFundamentalContent {
    overallConclusionKo: string;
    overallSentiment: FundamentalSentiment | null;
    categoryAssessments: NarrowedCategoryAssessment[];
    riskFactorsKo: string[];
}

/**
 * `content`를 fundamental 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * `overallConclusionKo`(종합 결론), `categoryAssessments`(카테고리별 평가, 각 `rationaleKo`를
 * 동반), `riskFactorsKo`(위험 요인)가 산문 소스다. 이 응답은 (overall과 마찬가지로) tier
 * 마스킹을 거치지 않으므로 네 필드 전부 값이 채워질 수 있다.
 */
export function narrowFundamentalContent(
    content: unknown
): NarrowedFundamentalContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const overallConclusionKo = narrowCleanString(record.overallConclusionKo);
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
 * `fundamental/page.tsx`가 `<FundamentalSnapshotProse>`를 렌더할지 아니면 클라이언트 AI 위젯
 * (`FundamentalAiSummary`)을 렌더할지 판단하는 예측기. 두 소스가 같은 필드
 * (overallConclusionKo/categoryAssessments/riskFactorsKo)를 중복 렌더하지 않도록 XOR로
 * 게이팅한다. 렌더러와 같은 `narrowFundamentalContent`를 쓰므로 둘이 서로 다른 판단을 내릴 수
 * 없다.
 */
export function hasFundamentalProse(content: unknown): boolean {
    return narrowFundamentalContent(content) !== null;
}
