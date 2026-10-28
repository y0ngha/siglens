/**
 * 축 점수(0–100) 진행 막대 — 점수 숫자와 등급 색 막대.
 */
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import type { FinancialsGrade } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { GRADE_PROGRESS_CLASS } from '../../utils/gradeStyles';

interface ScoreBarProps {
    score: number;
    grade: FinancialsGrade;
}

/** 막대 폭은 CSS 변수로 넘긴다 — 임의 값 클래스를 동적으로 조립하지 않기 위해서다. */
export function ScoreBar({ score, grade }: ScoreBarProps) {
    const t = useTranslations('widgets.financials');
    return (
        <div>
            <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs text-secondary-400">
                    {t('AxisScoreCard.67d2cf')}
                </span>
                <span className="font-mono text-sm font-semibold text-secondary-100 tabular-nums">
                    {score}
                </span>
            </div>
            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-700"
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
