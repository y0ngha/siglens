import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { ReactNode } from 'react';

interface OptionsEmptyStateProps {
    symbol: string;
    /**
     * Pre-rendered SEO snapshot prose section (`<OptionsSnapshotProse />`),
     * composed by the caller (app layer — this widget must not import
     * `@/views/**` directly per FSD dependency direction: widgets sit below
     * pages/views). `undefined` renders nothing extra. Threaded through so
     * this branch stays crawlable when a pre-warmed snapshot exists — spec
     * 2026-07-24 §7: "본문 degraded 분기에서도 섹션 유지".
     */
    snapshotSlot?: ReactNode;
}

const FALLBACK_LINK_CLASSES =
    'border-border-control hover:border-primary-500 focus-visible:ring-primary-500 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';

/**
 * 라벨·설명은 `shared.crossLink`를 재사용한다 — 같은 네 페이지를 가리키는
 * 카드가 여기와 `CrossLinkCards`에 두 벌 있었고, 둘 다 한국어 리터럴이라
 * 네 로케일 전부 한국어였다.
 */
const FALLBACK_PAGES = [
    { key: 'chart', href: (s: string) => `/${s}` },
    { key: 'fundamental', href: (s: string) => `/${s}/fundamental` },
    { key: 'news', href: (s: string) => `/${s}/news` },
    { key: 'fear-greed', href: (s: string) => `/${s}/fear-greed` },
] as const;

export function OptionsEmptyState({
    symbol,
    snapshotSlot,
}: OptionsEmptyStateProps) {
    const t = useTranslations('widgets.options');
    const tCard = useTranslations('shared.crossLink');
    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-16">
            <div className="rounded-lg border border-secondary-700 bg-secondary-800 p-8 text-center">
                <h1 className="text-xl font-bold tracking-tight text-balance text-secondary-50 sm:text-2xl">
                    {symbol} {t('OptionsEmptyState.68a411')}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-secondary-400">
                    {t('OptionsEmptyState.97e04b', { v0: symbol })}
                    <br />
                    {t('OptionsEmptyState.9e8562')}
                </p>
                <nav
                    className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    aria-label={t('OptionsEmptyState.840bca')}
                >
                    {FALLBACK_PAGES.map(({ key, href }) => (
                        <Link
                            key={key}
                            href={href(symbol)}
                            // 형제 탭 4개를 한 번에 노출 — docs/architecture/CDN_CACHING.md §1
                            prefetch={false}
                            className={FALLBACK_LINK_CLASSES}
                        >
                            <p className="font-semibold">
                                {tCard(`title.${key}`)}
                            </p>
                            <p className="mt-1 text-sm text-secondary-400">
                                {tCard(`description.${key}`)}
                            </p>
                        </Link>
                    ))}
                </nav>
            </div>
            {/* audit fix FIX 9: `snapshotSlot` is now `undefined` (not an
                always-truthy React element) when the caller has no renderable
                prose (options/page.tsx computes this via `hasOptionsProse`),
                so this `&&` no longer produces an empty `div.mt-6` when
                `OptionsSnapshotProse` would have returned null internally.
                `text-center` (the empty-state card's own alignment, above)
                isn't an ancestor of this sibling div, so the `text-left`
                override here was a no-op — dropped. */}
            {snapshotSlot && <div className="mt-6">{snapshotSlot}</div>}
        </main>
    );
}
