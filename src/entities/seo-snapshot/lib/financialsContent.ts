import type { FinancialsAxis, FinancialsSentiment } from '@y0ngha/siglens-core';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';
import { narrowStringArray } from './narrowStringArray';

/** FinancialsSentiment → `shared.enumLabel` 카탈로그 키. 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<FinancialsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

/**
 * FinancialsAxis → `shared.enumLabel` 카탈로그 키. 위젯의 축 라벨과 같은 라벨이지만, entity는
 * 위젯 레이어를 import할 수 없어 여기에 따로 정의한다.
 */
export const AXIS_LABEL_KEY: Record<FinancialsAxis, string> = {
    growth: 'financialsAxis.growth',
    quality: 'financialsAxis.quality',
    solvency: 'financialsAxis.solvency',
    cash: 'financialsAxis.cash',
};

const isAxis = createEnumGuard(AXIS_LABEL_KEY);

interface NarrowedAxisAssessment {
    axis: FinancialsAxis;
    sentiment: FinancialsSentiment | null;
    rationaleKo: string;
}

function narrowAxisAssessment(value: unknown): NarrowedAxisAssessment | null {
    const record = asRecord(value);
    if (record === null) return null;
    if (!isAxis(record.axis)) return null;

    return {
        axis: record.axis,
        sentiment: isSentiment(record.sentiment) ? record.sentiment : null,
        rationaleKo: narrowCleanString(record.rationaleKo),
    };
}

interface NarrowedFinancialsContent {
    overallConclusionKo: string;
    overallSentiment: FinancialsSentiment | null;
    axisAssessments: NarrowedAxisAssessment[];
    riskFactorsKo: string[];
}

/**
 * `content`를 financials 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * `overallConclusionKo`(종합 결론), `axisAssessments`(축별 평가, 각 `rationaleKo`를 동반),
 * `riskFactorsKo`(위험 요인)가 산문 소스다. 이 응답은 tier 마스킹을 거치지 않으므로 네 필드
 * 전부 값이 채워질 수 있다.
 */
export function narrowFinancialsContent(
    content: unknown
): NarrowedFinancialsContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const overallConclusionKo = narrowCleanString(record.overallConclusionKo);
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const axisAssessments = Array.isArray(record.axisAssessments)
        ? record.axisAssessments
              .map(narrowAxisAssessment)
              .filter(a => a !== null)
        : [];

    const riskFactorsKo = narrowStringArray(record.riskFactorsKo);

    if (
        overallConclusionKo.length === 0 &&
        axisAssessments.length === 0 &&
        riskFactorsKo.length === 0
    ) {
        return null;
    }

    return {
        overallConclusionKo,
        overallSentiment,
        axisAssessments,
        riskFactorsKo,
    };
}

/**
 * `financials/page.tsx`가 `<FinancialsSnapshotProse>`를 렌더할지 아니면 클라이언트 AI 위젯
 * (`FinancialsAiSummary`)을 렌더할지 판단하는 예측기. 두 소스가 같은 필드
 * (overallConclusionKo/axisAssessments/riskFactorsKo)를 중복 렌더하지 않도록 XOR로
 * 게이팅한다. 렌더러와 같은 `narrowFinancialsContent`를 쓰므로 둘이 서로 다른 판단을 내릴 수
 * 없다.
 */
export function hasFinancialsProse(content: unknown): boolean {
    return narrowFinancialsContent(content) !== null;
}
