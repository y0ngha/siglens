import type { CSSProperties } from 'react';
import { scoreToLabel, type FearGreedLabel } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

/**
 * Score → fill color class (semantic tokens; matches `FearGreedGauge` SEGMENTS).
 *
 * GREED가 `/85`인 이유: `/70`은 트랙 위에서 라이트 2.64:1로 3:1에 못 미친다
 * (실측). 알파를 아예 빼면 대비는 5.32/4.18로 좋아지지만 EXTREME_GREED와
 * **클래스가 같아져** 두 밴드가 하나로 합쳐지고, 밴드 매핑이 한 칸 밀려도
 * 테스트가 못 잡는다. `/85`가 다크 4.22 · 라이트 3.30으로 양 테마 3:1을 넘으면서
 * 클래스도 구분된다. `FearGreedGauge`의 SEGMENTS와 같은 값이어야 한다.
 */
const BAR_FILL_COLOR: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'bg-ui-danger',
    FEAR: 'bg-ui-warning',
    NEUTRAL: 'bg-secondary-400',
    GREED: 'bg-ui-success/85',
    EXTREME_GREED: 'bg-ui-success',
};

interface FearGreedScoreBarProps {
    /** 0–100 정수. 채움 폭과 색 밴드(`scoreToLabel`)를 함께 정한다. */
    value: number;
    /** progressbar의 접근 가능한 이름 — 호출부가 무엇의 점수인지 문장으로 준다. */
    label: string;
}

/** Fear & Greed 점수(또는 백분위) 막대 — 종목 그룹 막대와 시장 요인 막대가 공유한다. */
export function FearGreedScoreBar({ value, label }: FearGreedScoreBarProps) {
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-2 overflow-hidden rounded bg-secondary-700/70"
        >
            <div
                className={cn(
                    'h-full w-(--bar-width)',
                    BAR_FILL_COLOR[scoreToLabel(value)]
                )}
                style={{ '--bar-width': `${value}%` } as CSSProperties}
            />
        </div>
    );
}
