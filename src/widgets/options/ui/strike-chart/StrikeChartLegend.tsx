import { type ReactNode } from 'react';

interface StrikeChartLegendProps {
    /** `StrikeLegendItem` entries. */
    children: ReactNode;
}

/** Wrapping legend row beneath a strike chart. */
export function StrikeChartLegend({ children }: StrikeChartLegendProps) {
    return (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-secondary-500">
            {children}
        </div>
    );
}
