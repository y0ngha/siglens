import { useTranslations } from 'next-intl';
import type { FinancialsScorecard } from '@y0ngha/siglens-core';
import { CompositeGradeGauge } from './CompositeGradeGauge';
import { AxisScoreCard } from './AxisScoreCard';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from './utils/numberFormat';
import { AXIS_LABEL_KEY } from './axisLabels';

interface FinancialsScorecardProps {
    /** The complete 4-axis financials scorecard from computeFinancialsScorecard. */
    scorecard: FinancialsScorecard;
    /** 금액 지표에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
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
export function FinancialsScorecard({
    scorecard,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: FinancialsScorecardProps) {
    const t = useTranslations('widgets.financials');
    // extract.mjs의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는
    // 패턴만 본다 — `AXIS_LABEL_KEY[...]`를 그대로 `tLabel(...)`에 넣어야
    // `shared.enumLabel`이 이 라우트의 클라이언트 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    const { composite, growth, quality, solvency, cash } = scorecard;

    const axes = [
        {
            key: 'growth' as const,
            title: tLabel(AXIS_LABEL_KEY.growth),
            axis: growth,
        },
        {
            key: 'quality' as const,
            title: tLabel(AXIS_LABEL_KEY.quality),
            axis: quality,
        },
        {
            key: 'solvency' as const,
            title: tLabel(AXIS_LABEL_KEY.solvency),
            axis: solvency,
        },
        {
            key: 'cash' as const,
            title: tLabel(AXIS_LABEL_KEY.cash),
            axis: cash,
        },
    ];

    return (
        <section
            aria-labelledby="financials-scorecard-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="financials-scorecard-heading"
                className="mb-6 text-lg font-semibold tracking-tight"
            >
                {t('FinancialsScorecard.b5f196')}
            </h2>

            <div className="mb-8">
                <CompositeGradeGauge
                    score={composite.score}
                    grade={composite.grade}
                    summaryKo={composite.summaryKo}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {axes.map(({ key, title, axis }) => (
                    <AxisScoreCard
                        key={key}
                        axisKey={key}
                        title={title}
                        axis={axis}
                        currency={currency}
                    />
                ))}
            </div>
        </section>
    );
}
