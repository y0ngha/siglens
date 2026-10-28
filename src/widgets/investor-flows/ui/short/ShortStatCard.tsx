/**
 * 공매도 잔고 블록의 최신 값 카드 한 장 — 라벨(선택적 용어 풀이)과 큰 값.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../../investorFlowsTooltips';

interface ShortStatCardProps {
    readonly label: string;
    readonly tooltip?: 'pctOfFloat' | 'daysToCover';
    readonly children: ReactNode;
}

/** `<ul>` 안에 놓는 `<li>` 카드. */
export function ShortStatCard({
    label,
    tooltip,
    children,
}: ShortStatCardProps) {
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">
                {label}
                {tooltip !== undefined && <FlowTooltip term={tooltip} />}
            </p>
            <p className="mt-1 text-lg font-semibold text-secondary-100 tabular-nums">
                {children}
            </p>
        </li>
    );
}
