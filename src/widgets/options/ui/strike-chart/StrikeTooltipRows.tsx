interface StrikeTooltipRowsProps {
    strike: number;
    callLabel: string;
    putLabel: string;
    totalLabel: string;
    /** Already formatted call-side value. */
    callValue: string;
    /** Already formatted put-side value. */
    putValue: string;
    /** Already formatted call + put value. */
    totalValue: string;
}

/**
 * Tooltip body layout shared by the strike charts: strike heading, call and
 * put rows, and a total row. Values arrive formatted so each chart owns its
 * unit wording.
 */
export function StrikeTooltipRows({
    strike,
    callLabel,
    putLabel,
    totalLabel,
    callValue,
    putValue,
    totalValue,
}: StrikeTooltipRowsProps) {
    return (
        <>
            <div className="mb-1 font-semibold text-secondary-300 tabular-nums">
                Strike ${strike.toLocaleString()}
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="text-ui-success-text">{callLabel}</span>
                <span className="tabular-nums">{callValue}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="text-ui-danger-text">{putLabel}</span>
                <span className="tabular-nums">{putValue}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-secondary-700 pt-1">
                <span className="text-secondary-400">{totalLabel}</span>
                <span className="font-semibold tabular-nums">{totalValue}</span>
            </div>
        </>
    );
}
