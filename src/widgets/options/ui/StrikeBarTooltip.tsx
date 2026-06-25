'use client';

import { type CSSProperties, type ReactNode } from 'react';
import {
    TOOLTIP_MIN_WIDTH_PX,
    type TooltipPosition,
} from '../utils/computeTooltipPos';

interface StrikeBarTooltipProps {
    /** DOM id — aria-describedby와 role="tooltip" 양쪽에서 일치해야 함. */
    id: string;
    /** 현재 hover 중인 row (null이면 hidden). non-null일 때는 항상 객체이며,
     *  컴포넌트 내부에서는 null 여부만 확인하므로 `object`로 받는다. */
    hoveredRow: object | null;
    /** computeTooltipPos가 반환한 컨테이너 기준 좌표. */
    tooltipPos: TooltipPosition | null;
    /** 툴팁 내용. 각 차트가 자신의 데이터 포맷으로 렌더링한다. */
    children: ReactNode;
}

/**
 * Strike 바 차트 공용 floating tooltip 셸.
 *
 * OpenInterestChart·StrikeVolumeChart 양쪽이 완전히 동일한 div 구조
 * (hidden 속성, CSS 변수, 클래스셋)를 복제하고 있어 여기로 추출한다.
 * id와 내용(children)만 차트별로 다르므로 props로 주입받는다.
 *
 * ## 접근성 트레이드오프
 * `hidden` 속성으로 숨기면 접근성 트리에서도 제거되어 screen reader가
 * aria-describedby 참조를 따라올 수 없지만, 하단 sr-only 테이블이 전체
 * 데이터를 제공하므로 이 pointer-only 툴팁에서는 허용 가능한 트레이드오프다.
 */
export function StrikeBarTooltip({
    id,
    hoveredRow,
    tooltipPos,
    children,
}: StrikeBarTooltipProps) {
    return (
        <div
            id={id}
            role="tooltip"
            hidden={hoveredRow === null || tooltipPos === null}
            className="border-secondary-600 bg-secondary-900/95 text-secondary-100 pointer-events-none absolute top-[var(--tooltip-y)] left-[var(--tooltip-x)] z-10 min-w-[var(--tooltip-min-w)] -translate-x-1/2 -translate-y-full rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={
                // CSS 커스텀 프로퍼티(--*)는 런타임에 유효하나 React의
                // CSSProperties 타입은 임의 `--*` 키를 포함하지 않아
                // 인덱스 시그니처가 막힘 — TS 한계 우회용 cast이며
                // 런타임 리스크는 없다.
                {
                    '--tooltip-x': `${tooltipPos?.x ?? 0}px`,
                    '--tooltip-y': `${tooltipPos?.y ?? 0}px`,
                    '--tooltip-min-w': `${TOOLTIP_MIN_WIDTH_PX}px`,
                } as CSSProperties
            }
        >
            {hoveredRow !== null && children}
        </div>
    );
}
