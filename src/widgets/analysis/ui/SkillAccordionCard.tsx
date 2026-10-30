'use client';

/**
 * 패턴·전략 카드가 공유하는 아코디언 껍데기 — 제목·추세 배지·펼침 버튼, 작도 토글,
 * 신뢰도 배지로 된 헤더와 펼쳤을 때만 마운트되는 본문.
 */
import { useState, type ReactNode } from 'react';
import type { Trend } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';
import type { OverlayCardControls } from '../model/types';
import { overlayHoverHandlers } from '../utils/overlayCardControls';
import { ConfidenceBadge } from './ConfidenceBadge';
import { OverlayToggleButton } from './OverlayToggleButton';
import { TrendBadge } from './TrendBadge';

interface SkillAccordionCardProps {
    /** 결과 id — 작도 key로 쓴다. */
    id: string;
    /** 로케일 표시명(`useSkillLabel`을 거친 값). */
    title: string;
    trend: Trend | null | undefined;
    confidenceWeight: number;
    /**
     * confidence 정보 깊이가 잠긴 티어에서는 confidenceWeight가 0으로 마스킹되어
     * 도착한다. 0을 그대로 그리면 'medium'으로 오표시되므로 잠긴 경우 배지를 숨긴다.
     */
    showConfidence: boolean;
    /** 차트 작도 제어 — 이 항목에 그려지는 작도가 없으면 undefined(버튼 없음). */
    overlay?: OverlayCardControls;
    /** 펼친 본문. 닫혀 있으면 렌더하지 않는다. */
    children: ReactNode;
}

export function SkillAccordionCard({
    id,
    title,
    trend,
    confidenceWeight,
    showConfidence,
    overlay,
    children,
}: SkillAccordionCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className={cn(SURFACE_NESTED, 'overflow-hidden')}
            {...overlayHoverHandlers(overlay, id)}
        >
            <div className="flex w-full items-center transition-colors hover:bg-secondary-700/50">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(prev => !prev)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-300">
                        {title}
                    </span>
                    <TrendBadge trend={trend} />
                    <ChevronDownIcon
                        className={cn(
                            'size-4 text-secondary-500 transition-transform duration-200',
                            isOpen && 'rotate-180'
                        )}
                    />
                </button>
                {overlay !== undefined && (
                    <OverlayToggleButton
                        cardTitle={title}
                        overlayKey={id}
                        overlay={overlay}
                    />
                )}
                {showConfidence && (
                    <span className="shrink-0 pr-2">
                        <ConfidenceBadge confidenceWeight={confidenceWeight} />
                    </span>
                )}
            </div>

            {isOpen ? (
                <div className="flex flex-col gap-2.5 border-t border-secondary-700 bg-secondary-800/60 px-3 py-2.5">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
