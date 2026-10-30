/**
 * 게이지 아래의 판독부 — 점수, 등급 글자, 한 줄 요약.
 */
import type { FinancialsGrade } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SCORE_MAX } from '../../utils/gaugeGeometry';
import { GRADE_TEXT_COLOR } from '../../utils/gradeStyles';

/** 점수가 없을 때 숫자 자리에 쓰는 표기. */
const NO_SCORE_TEXT = '-';

interface GaugeReadoutProps {
    score: number | null;
    grade: FinancialsGrade;
    summaryKo: string;
}

/** 점수가 `null`이면 숫자 자리에 `-`를 쓰고 `/ 100`은 숨긴다. */
export function GaugeReadout({ score, grade, summaryKo }: GaugeReadoutProps) {
    return (
        <div className="text-center">
            <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-mono text-5xl font-bold text-secondary-100 tabular-nums">
                    {score ?? NO_SCORE_TEXT}
                </span>
                {score !== null && (
                    <span className="text-xs text-secondary-400">
                        / {SCORE_MAX}
                    </span>
                )}
            </div>
            <div
                className={cn(
                    'text-4xl font-bold tracking-tight',
                    GRADE_TEXT_COLOR[grade]
                )}
            >
                {grade}
            </div>
            <div className="mt-1 text-sm text-secondary-300">{summaryKo}</div>
        </div>
    );
}
