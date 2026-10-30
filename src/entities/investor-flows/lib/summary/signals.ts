import type {
    InvestorFlowsEvidence,
    InvestorFlowsScorecard,
    InvestorFlowsSignal,
    InvestorFlowsSignalStrength,
} from '@y0ngha/siglens-core';
import type { SummaryAxis, SummarySignal } from './types';
import {
    SUMMARY_NAME_MAX_CHARS,
    SUMMARY_RATIO_DIGITS,
    round,
    clipSummaryText,
} from './format';

const STRENGTH_RANK: Readonly<Record<InvestorFlowsSignalStrength, number>> = {
    strong: 3,
    moderate: 2,
    weak: 1,
};

/** 요약에 싣는 신호 수 상한. */
export const SUMMARY_MAX_SIGNALS = 5;

function compactEvidence(
    evidence: InvestorFlowsEvidence
): InvestorFlowsEvidence {
    return Object.fromEntries(
        Object.entries(evidence).map(([key, value]) => [
            key,
            value === null ? null : round(value, SUMMARY_RATIO_DIGITS),
        ])
    );
}

/** 다섯 축 신호를 강도 순(같으면 원래 순서)으로 `SUMMARY_MAX_SIGNALS`개까지 — 한국 요약도 같은 규칙이다. */
export function pickSummarySignals(
    scorecard: InvestorFlowsScorecard
): SummarySignal[] {
    const all: readonly InvestorFlowsSignal[] = [
        ...scorecard.institutional.signals,
        ...scorecard.insider.signals,
        ...scorecard.largeHolders.signals,
        ...scorecard.short.signals,
        ...scorecard.dilution.signals,
    ];
    return all
        .map((signal, index) => ({ signal, index }))
        .toSorted(
            (a, b) =>
                STRENGTH_RANK[b.signal.strength] -
                    STRENGTH_RANK[a.signal.strength] || a.index - b.index
        )
        .slice(0, SUMMARY_MAX_SIGNALS)
        .map(({ signal }) => ({
            id: signal.id,
            axis: signal.axis,
            direction: signal.direction,
            strength: signal.strength,
            evidence: compactEvidence(signal.evidence),
            ...(signal.subject === undefined
                ? {}
                : {
                      subject: clipSummaryText(
                          signal.subject,
                          SUMMARY_NAME_MAX_CHARS
                      ),
                  }),
        }));
}

/** 점수표 축에서 요약에 필요한 필드만 복사한다(점수표 객체를 그대로 공유하지 않는다). */
export function summarizeAxis(axis: SummaryAxis): SummaryAxis {
    return {
        label: axis.label,
        score: axis.score,
        sufficiency: axis.sufficiency,
    };
}
