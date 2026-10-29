/**
 * 스냅샷 산문 렌더러들이 공유하는 라벨 붙은 글머리표 목록.
 */
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
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
 * financials/congress) — labeled heading + `role="list"` + `aria-hidden`
 * bullet span + `min-w-0 break-words` item text — so the renderers' list blocks
 * (scenarios, risk factors, key events, notable members …) can't drift apart.
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
            <h3 className={cn('mb-1.5', HEADING_SUBSECTION)}>{title}</h3>
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
