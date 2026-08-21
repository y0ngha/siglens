import { useTranslations } from 'next-intl';
interface SnapshotBulletListProps {
    title: string;
    symbol: string;
    ariaSuffix: string;
    items: string[];
    keyPrefix: string;
}

/**
 * Shared list markup for the plain-string bullet arrays that recur across
 * every `*SnapshotProse` renderer (technical/overall/news/fundamental/
 * financials/congress) — labeled heading + `role="list"` (FIX 7a) +
 * `aria-hidden` bullet span + `min-w-0 break-words` item text (FIX 7b).
 * Originally extracted inside `OverallSnapshotProse` (PR #698 round-2 FIX 2)
 * for its own five axis-bullet arrays, then promoted here (PR #698 round-3
 * FIX 2) so the identical markup previously duplicated inline in
 * `OverallSnapshotProse` (strength/neutral/weak scenarios + risk factors),
 * `NewsSnapshotProse` (핵심 이벤트/다가오는 일정), `FundamentalSnapshotProse`/
 * `FinancialsSnapshotProse` (위험 요인), and `CongressSnapshotProse` (주목할
 * 인물) can't drift from each other.
 *
 * Only for blocks whose items are plain strings rendered verbatim. Blocks
 * that compose an item from multiple fields (e.g. a label prefix + a
 * separate rationale paragraph, or a key derived from something other than
 * the item text — see `axisAssessments`/`categoryAssessments`/
 * `perExpiration`/`signals` in the financials/fundamental/options
 * renderers) are intentionally left inline rather than bent to fit this
 * shape.
 *
 * Renders nothing when `items` is empty — callers don't need their own
 * length guard.
 */
export function SnapshotBulletList({
    title,
    symbol,
    ariaSuffix,
    items,
    keyPrefix,
}: SnapshotBulletListProps) {
    // 훅은 조기 반환보다 위에 — 빈 목록 렌더에서만 훅이 사라지면 안 된다.
    const tMisc = useTranslations('shared.ui.misc');
    if (items.length === 0) return null;

    return (
        <div>
            <h3 className="mb-1.5 text-sm font-semibold text-secondary-200">
                {title}
            </h3>
            <ul
                role="list"
                aria-label={tMisc('bulletListAria', {
                    v0: symbol,
                    v1: ariaSuffix,
                })}
                className="space-y-1"
            >
                {items.map((item, i) => (
                    <li
                        key={`${keyPrefix}-${i}-${item}`}
                        className="flex gap-2"
                    >
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            •
                        </span>
                        <span className="min-w-0 break-words">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
