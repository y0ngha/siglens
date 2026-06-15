import type { FinancialsScorecard } from '@y0ngha/siglens-core';
import { CompositeGradeGauge } from './CompositeGradeGauge';
import { AxisScoreCard } from './AxisScoreCard';
import { AXIS_LABEL_KO } from './axisLabels';

interface FinancialsScorecardProps {
    /** The complete 4-axis financials scorecard from computeFinancialsScorecard. */
    scorecard: FinancialsScorecard;
}

/**
 * Full financials scorecard widget — SSR-safe, synchronous, takes a
 * pre-computed `FinancialsScorecard` prop.
 *
 * Layout:
 * - Section card wrapper with h2 heading
 * - `CompositeGradeGauge` hero showing the composite score + grade + summary
 * - 4× `AxisScoreCard` in a responsive grid (2-col mobile / 4-col desktop)
 */
export function FinancialsScorecard({ scorecard }: FinancialsScorecardProps) {
    const { composite, growth, quality, solvency, cash } = scorecard;

    const axes = [
        { key: 'growth' as const, title: AXIS_LABEL_KO.growth, axis: growth },
        {
            key: 'quality' as const,
            title: AXIS_LABEL_KO.quality,
            axis: quality,
        },
        {
            key: 'solvency' as const,
            title: AXIS_LABEL_KO.solvency,
            axis: solvency,
        },
        { key: 'cash' as const, title: AXIS_LABEL_KO.cash, axis: cash },
    ];

    return (
        <section
            aria-labelledby="financials-scorecard-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="financials-scorecard-heading"
                className="mb-6 text-lg font-semibold tracking-tight"
            >
                재무 종합 점수
            </h2>

            <div className="mb-8">
                <CompositeGradeGauge
                    score={composite.score}
                    grade={composite.grade}
                    summaryKo={composite.summaryKo}
                />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {axes.map(({ key, title, axis }) => (
                    <AxisScoreCard key={key} title={title} axis={axis} />
                ))}
            </div>
        </section>
    );
}
