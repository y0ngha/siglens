/**
 * 스코어카드 축 하나의 카드 — 점수 막대, 등급, 신호 칩, 핵심 지표.
 */
import type { FinancialsAxis, AxisScore } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { MetricRow } from './ui/axis-card/MetricRow';
import { ScoreBar } from './ui/axis-card/ScoreBar';
import { SignalChip } from './ui/axis-card/SignalChip';
import { GRADE_BADGE_CLASS } from './utils/gradeStyles';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from './utils/statementCurrency';

interface AxisScoreCardProps {
    /** 카드 제목으로 쓰는 축 이름(번역 완료). */
    title: string;
    /** DOM id에 쓰는 안정적인 영문 축 키 — id에 한글이 들어가지 않게 한다. */
    axisKey: FinancialsAxis;
    /** 스코어카드의 축 점수 객체. */
    axis: AxisScore;
    /** 금액 지표에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

/**
 * 축 제목과 등급 배지, 점수 막대, 신호 칩(방향별 색), 핵심 지표 목록(단위별 포맷)을 한 카드로
 * 보여 준다.
 */
export function AxisScoreCard({
    title,
    axisKey,
    axis,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: AxisScoreCardProps) {
    const { score, grade, signals, metrics } = axis;
    const headingId = `axis-${axisKey}-heading`;

    return (
        <section
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'flex flex-col gap-4 p-4 sm:p-6')}
        >
            <div className="flex items-center justify-between">
                <h3 id={headingId} className={HEADING_SUBSECTION}>
                    {title}
                </h3>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-sm font-bold',
                        GRADE_BADGE_CLASS[grade]
                    )}
                >
                    {grade}
                </span>
            </div>

            <ScoreBar score={score} grade={grade} />

            {signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {signals.map(signal => (
                        <SignalChip key={signal.type} signal={signal} />
                    ))}
                </div>
            )}

            {metrics.length > 0 && (
                <div>
                    {metrics.map(metric => (
                        <MetricRow
                            key={metric.labelKo}
                            metric={metric}
                            currency={currency}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
