/** The "based on" footer of a finished replay: source chips and the as-of time. */

interface ReplaySourcesProps {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
    /**
     * The `|` divider before the as-of time. The ad landings (`/lp`) leave it
     * out: their copy carries no divider symbols.
     */
    readonly separator?: boolean;
}

/** Label, one chip per source, then the as-of time (divider hidden from AT). */
export function ReplaySources({
    label,
    sources,
    asOf,
    separator = true,
}: ReplaySourcesProps) {
    return (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-secondary-700 pt-2.5 text-xs text-secondary-400">
            {label}
            {sources.map(source => (
                <span
                    key={source}
                    className="rounded bg-secondary-700/40 px-2 py-0.5 font-medium text-secondary-300"
                >
                    {source}
                </span>
            ))}
            <span className="tabular-nums">
                {separator ? <span aria-hidden="true">| </span> : null}
                {asOf}
            </span>
        </p>
    );
}
