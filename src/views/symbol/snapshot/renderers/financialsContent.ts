import type { FinancialsAxis, FinancialsSentiment } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

/** FinancialsSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
export const SENTIMENT_LABEL_KEY: Record<FinancialsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

// `src/widgets/financials/axisLabels.ts`의 AXIS_LABEL_KO와 동일 라벨 —
// 이 렌더러는 위젯 레이어에 의존하지 않는 established pattern
// (TechnicalSnapshotProse/OverallSnapshotProse)을 따라 자체 정의한다.
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
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!isAxis(record.axis)) return null;

    return {
        axis: record.axis,
        sentiment: isSentiment(record.sentiment) ? record.sentiment : null,
        rationaleKo:
            typeof record.rationaleKo === 'string'
                ? stripSnapshotMarkdown(record.rationaleKo).trim()
                : '',
    };
}

interface NarrowedFinancialsContent {
    overallConclusionKo: string;
    overallSentiment: FinancialsSentiment | null;
    axisAssessments: NarrowedAxisAssessment[];
    riskFactorsKo: string[];
}

/**
 * `content`를 financials 결과 모양으로 좁힌다.
 *
 * `overallConclusionKo`(종합 결론), `axisAssessments`(축별 평가, 각
 * `rationaleKo`를 동반), `riskFactorsKo`(위험 요인)가 프로즈 소스다. 이
 * 응답은 tier 마스킹을 거치지 않으므로 네 필드 전부 값이 채워질 수 있다.
 */
export function narrowFinancialsContent(
    content: unknown
): NarrowedFinancialsContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const overallConclusionKo =
        typeof record.overallConclusionKo === 'string'
            ? stripSnapshotMarkdown(record.overallConclusionKo).trim()
            : '';
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
 * `financials/page.tsx`가 `<FinancialsSnapshotProse>`를 렌더할지 아니면
 * 클라이언트 AI 위젯(`FinancialsAiSummary`)을 렌더할지 판단하는
 * 예측기(audit fix FIX 2 — `OverallSnapshotProse.hasOverallProse` 패턴). 두
 * 소스가 같은 필드(overallConclusionKo/axisAssessments/riskFactorsKo)를 같은
 * 순서로 중복 렌더하던 문제를 XOR 게이팅으로 해소한다.
 *
 * `narrowFinancialsContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로
 * 다른 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasFinancialsProse(content: unknown): boolean {
    return narrowFinancialsContent(content) !== null;
}
