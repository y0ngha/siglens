import Link from 'next/link';
import {
    NEWS_CATEGORY_SLUGS,
    type NewsFeedCategory,
} from '@/entities/market-news';
import { cn } from '@/shared/lib/cn';

/**
 * Short, tab-sized labels for the category strip. Distinct from
 * `CATEGORY_CONFIG.koLabel` (e.g. "미국 일반 시장"), which is too long for a
 * horizontally-scrolling tab bar and carries SEO/AI-prompt roles that must not
 * change. These are a UI concern, so they live in the widget layer.
 */
const TAB_LABELS: Record<NewsFeedCategory, string> = {
    general: '일반',
    stock: '주식',
    crypto: '암호화폐',
    forex: '외환',
    articles: '아티클',
};

interface NewsCategoryTabsProps {
    /** The category currently being viewed — rendered as the active tab. */
    readonly activeCategory: NewsFeedCategory;
}

/**
 * Category navigation strip for /news/[category] pages. URL-based nav (links +
 * aria-current), not a tablist — each tab is a real page. Mirrors `SymbolTabs`:
 * `overflow-x-auto` + `whitespace-nowrap` so the five labels scroll horizontally
 * on narrow viewports (375px) instead of wrapping or overflowing the layout.
 *
 * Server component (the active tab is known from the route param), so it adds
 * no client JS — `usePathname` is unnecessary.
 */
export function NewsCategoryTabs({ activeCategory }: NewsCategoryTabsProps) {
    return (
        <nav
            aria-label="뉴스 카테고리"
            className="flex overflow-x-auto border-b border-secondary-700"
        >
            {NEWS_CATEGORY_SLUGS.map(category => {
                const active = category === activeCategory;
                return (
                    <Link
                        key={category}
                        href={`/news/${category}`}
                        // 카테고리 탭 전체가 한 화면에 있어 마운트 즉시 전부 prefetch된다.
                        // `_rsc` 해시가 진입 경로마다 달라 캐시 재사용이 안 되므로
                        // (docs/architecture/CDN_CACHING.md §1) 클릭 시점으로 미룬다.
                        prefetch={false}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'focus-visible:ring-primary-500 flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            active
                                ? 'border-primary-500 text-secondary-100 font-medium'
                                : 'text-secondary-400 hover:text-secondary-100'
                        )}
                    >
                        {TAB_LABELS[category]}
                    </Link>
                );
            })}
        </nav>
    );
}
