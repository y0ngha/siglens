/**
 * 브리핑의 주요 테마 칩 줄.
 */
interface BriefingThemesProps {
    themes: readonly string[];
}

/** 테마가 없으면 줄 자체를 그리지 않는다. */
export function BriefingThemes({ themes }: BriefingThemesProps) {
    if (themes.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {themes.map(theme => (
                <span
                    key={theme}
                    className="rounded bg-secondary-700/50 px-2 py-0.5 text-xs text-secondary-400"
                >
                    {theme}
                </span>
            ))}
        </div>
    );
}
