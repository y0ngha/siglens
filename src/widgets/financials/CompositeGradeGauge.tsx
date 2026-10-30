/**
 * 재무 종합 점수(0–100) 반원 게이지 — 호·눈금·바늘은 `ui/gauge`가 그린다.
 */
import { useTranslations } from 'next-intl';
import type { FinancialsGrade } from '@y0ngha/siglens-core';
import { GaugeArc } from './ui/gauge/GaugeArc';
import { GaugeNeedle } from './ui/gauge/GaugeNeedle';
import { GaugeReadout } from './ui/gauge/GaugeReadout';
import { GaugeTicks } from './ui/gauge/GaugeTicks';
import { GAUGE_VIEWBOX_H, GAUGE_VIEWBOX_W } from './utils/gaugeGeometry';

interface CompositeGradeGaugeProps {
    /** 종합 점수 0–100. `null`이면 숫자 자리에 "-"를 보인다. */
    score: number | null;
    /** 점수에서 산출한 등급 글자. */
    grade: FinancialsGrade;
    /** 가장 강한 축과 약한 축을 짚는 한국어 한 줄 요약. */
    summaryKo: string;
}

/**
 * FearGreedGauge의 반원 패턴을 재무 스코어카드에 맞춘 게이지. 0점이 왼쪽(최악), 100점이
 * 오른쪽(최고)이다.
 *
 * 접근성: SVG에 `role="img"` + `aria-label`을 둔다. 점수가 없으면 점수 없는 문구를 쓴다.
 */
export function CompositeGradeGauge({
    score,
    grade,
    summaryKo,
}: CompositeGradeGaugeProps) {
    const tGauge = useTranslations('widgets.financials.gradeGauge');
    const ariaLabel =
        score === null
            ? tGauge('ariaNoScore', { v0: grade })
            : tGauge('aria', { v0: score, v1: grade });

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox={`0 0 ${GAUGE_VIEWBOX_W} ${GAUGE_VIEWBOX_H}`}
                className="w-full max-w-[420px]"
                role="img"
                aria-label={ariaLabel}
            >
                <GaugeArc />
                <GaugeTicks />
                <GaugeNeedle score={score} />
            </svg>
            <GaugeReadout score={score} grade={grade} summaryKo={summaryKo} />
        </div>
    );
}
