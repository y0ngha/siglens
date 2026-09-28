interface Props {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
}

/**
 * `shared/ui/ReplayParts`' `ReplaySources` markup, minus its hard-coded
 * middle-dot separator: the ad landing copy rules ban `·`
 * (spec `2026-09-26-ad-landing-pages-design.md`).
 */
export function LpReplaySources({ label, sources, asOf }: Props) {
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
            <span className="tabular-nums">{asOf}</span>
        </p>
    );
}
