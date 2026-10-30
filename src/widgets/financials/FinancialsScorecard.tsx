/**
 * 재무 스코어카드 위젯 — 종합 게이지와 4축 카드. SSR 안전·동기 렌더이며 미리 계산된
 * `FinancialsScorecard`를 prop으로 받는다.
 */
import { useTranslations } from 'next-intl';
import type { FinancialsScorecard as FinancialsScorecardData } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { AxisScoreCard } from './AxisScoreCard';
import { CompositeGradeGauge } from './CompositeGradeGauge';
import { SCORECARD_AXES, axisLabelKey } from './utils/axisLabels';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from './utils/statementCurrency';

interface FinancialsScorecardProps {
    /** `computeFinancialsScorecard`가 만든 4축 스코어카드 전체. */
    scorecard: FinancialsScorecardData;
    /** 금액 지표에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

/**
 * 제목 아래에 종합 게이지(점수·등급·요약)를 크게 두고, 4축 카드를 반응형 그리드(모바일 2열 /
 * 데스크톱 4열)로 늘어놓는다.
 */
export function FinancialsScorecard({
    scorecard,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: FinancialsScorecardProps) {
    const t = useTranslations('widgets.financials');
    // extract.mjs의 동적 키 탐지는 이 파일 안에서 번역자를 직접 호출하는 패턴만 본다 —
    // `axisLabelKey(...)`를 그대로 `tLabel(...)`에 넣어야 `shared.enumLabel`이 이 라우트의
    // 클라이언트 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    const { composite } = scorecard;

    return (
        <section
            aria-labelledby="financials-scorecard-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2
                id="financials-scorecard-heading"
                className={cn('mb-6', HEADING_SECTION)}
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
                {SCORECARD_AXES.map(axis => (
                    <AxisScoreCard
                        key={axis}
                        axisKey={axis}
                        title={tLabel(axisLabelKey(axis))}
                        axis={scorecard[axis]}
                        currency={currency}
                    />
                ))}
            </div>
        </section>
    );
}
