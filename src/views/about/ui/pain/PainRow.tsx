/** One "before / with SIGLENS" row of the `/about` pain section. */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { PainPoint } from '../../lib/types';

interface PainRowProps {
    readonly pain: PainPoint;
    readonly wasLabel: string;
    /** 오른쪽 칸 머리 — 로케일 브랜드(ko `시그렌즈`). */
    readonly nowLabel: string;
}

/** The complaint on the left, SIGLENS's answer on the right (stacked on mobile). */
export function PainRow({ pain, wasLabel, nowLabel }: PainRowProps) {
    return (
        <li
            className={cn(
                SURFACE_CARD,
                'grid overflow-hidden sm:grid-cols-[2fr_3fr]'
            )}
        >
            <div className="border-b border-secondary-700 bg-secondary-900 px-4 py-3.5 sm:border-r sm:border-b-0">
                <p className="text-xs text-secondary-400">{wasLabel}</p>
                <p className="mt-1 text-[15px] leading-6 text-secondary-300">
                    {pain.was}
                </p>
            </div>
            <div className="px-4 py-3.5">
                <p
                    className="text-xs font-semibold text-secondary-100"
                    translate="no"
                >
                    {nowLabel}
                </p>
                <p className="mt-1 text-[15px] leading-6 text-secondary-100">
                    {pain.now}
                </p>
            </div>
        </li>
    );
}
