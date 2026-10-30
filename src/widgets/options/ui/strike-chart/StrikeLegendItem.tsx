import { type ReactNode } from 'react';

type LegendSwatch = 'call' | 'put' | 'dashedLine' | 'solidLine';

const SWATCH_CLASS: Record<LegendSwatch, string> = {
    call: 'inline-block h-2.5 w-2.5 rounded bg-chart-bullish',
    put: 'inline-block h-2.5 w-2.5 rounded bg-chart-bearish',
    dashedLine:
        'inline-block w-[14px] border-t-[1.5px] border-dashed border-ui-warning',
    solidLine:
        'inline-block w-[14px] border-t-[1.5px] border-solid border-ui-warning',
};

interface StrikeLegendItemProps {
    /** Swatch shape: filled chip for bars, dashed/solid stroke for guide lines. */
    swatch: LegendSwatch;
    /** Label text and optional trailing tooltip. */
    children: ReactNode;
}

/** One legend entry (swatch + label) shared by the strike chart legends. */
export function StrikeLegendItem({ swatch, children }: StrikeLegendItemProps) {
    return (
        <span className="flex items-center gap-1">
            <span className={SWATCH_CLASS[swatch]} aria-hidden="true" />
            {children}
        </span>
    );
}
