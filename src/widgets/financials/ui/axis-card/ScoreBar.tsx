/**
 * 축 점수(0–100) 진행 막대 — 점수 숫자와 등급 색 막대.
 */
import { useTranslations } from 'next-intl';
import { useId, type CSSProperties } from 'react';
import type { FinancialsGrade } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { GRADE_PROGRESS_CLASS } from '../../utils/gradeStyles';
import { SCORE_MAX, SCORE_MIN } from '../../utils/gaugeGeometry';

interface ScoreBarProps {
    score: number;
    grade: FinancialsGrade;
}

/**
 * 막대 폭은 CSS 변수로 넘긴다 — 임의 값 클래스를 동적으로 조립하지 않기 위해서다. 막대는
 * `progressbar`로 노출해 보조 기술이 점수와 범위를 함께 읽게 한다.
 */
export function ScoreBar({ score, grade }: ScoreBarProps) {
    const t = useTranslations('widgets.financials');
    const labelId = useId();
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between">
                <span id={labelId} className="text-xs text-secondary-400">
                    {t('AxisScoreCard.67d2cf')}
                </span>
                <span className="font-mono text-sm font-semibold text-secondary-100 tabular-nums">
                    {score}
                </span>
            </div>
            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-700"
                role="progressbar"
                aria-labelledby={labelId}
                aria-valuenow={score}
                aria-valuemin={SCORE_MIN}
                aria-valuemax={SCORE_MAX}
                style={{ '--axis-score-pct': `${score}%` } as CSSProperties}
            >
                <div
                    className={cn(
                        'h-full w-[var(--axis-score-pct)] rounded-full',
                        GRADE_PROGRESS_CLASS[grade]
                    )}
                />
            </div>
        </div>
    );
}
