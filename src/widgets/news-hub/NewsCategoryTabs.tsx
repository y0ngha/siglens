import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { cn } from '@/shared/lib/cn';

/**
 * Short, tab-sized labels for the category strip. Distinct from
 * `CATEGORY_CONFIG.koLabel` (e.g. "미국 일반 시장"), which is too long for a
 * horizontally-scrolling tab bar and carries SEO/AI-prompt roles that must not
 * change. These are a UI concern, so they live in the widget layer.
 */

interface NewsCategoryTabsProps {
    /** The category currently being viewed — rendered as the active tab. */
    readonly activeCategory: NewsFeedCategoryId;
}

/**
 * Category navigation strip for /news/[category] pages. URL-based nav (links +
 * aria-current), not a tablist — each tab is a real page. Mirrors `SymbolTabs`:
 * `overflow-x-auto` + `whitespace-nowrap` so the labels scroll horizontally
 * on narrow viewports (375px) instead of wrapping or overflowing the layout.
 *
 * **같은 지역의 카테고리만 나열한다.** 지역(미국·한국·암호화폐)은 위쪽
 * `RegionTabs`가 이미 고르고 있어서, 여기에 전 지역을 섞으면 같은 화면에 두 개의
 * 지역 선택기가 생긴다 — `미국 주식` 옆에 `국내 증시` 탭이 붙으면 지역을 나눈
 * 의미가 사라진다. 지역에 카테고리가 하나뿐이면(한국·암호화폐) 아무것도 렌더하지
 * 않는다: 선택지가 없는 탭 하나는 정보가 0이고 세로 공간만 먹는다.
 *
 * Server component (the active tab is known from the route param), so it adds
 * no client JS — `usePathname` is unnecessary.
 */
export function NewsCategoryTabs({ activeCategory }: NewsCategoryTabsProps) {
    const t = useTranslations('widgets.news-hub');
    // 카테고리 라벨은 `entities.market-news.category`가 단일 소스다 —
    // 위젯에 한국어 테이블을 따로 두면 두 곳이 갈린다.
    const tCat = useTranslations('entities.market-news.category');
    const siblings = categoriesInRegion(CATEGORY_CONFIG[activeCategory].region);
    if (siblings.length < 2) return null;

    return (
        <nav
            aria-label={t('NewsCategoryTabs.ab8544')}
            className="flex overflow-x-auto border-b border-secondary-700"
        >
            {siblings.map(category => {
                const active = category === activeCategory;
                const className = cn(
                    'focus-visible:ring-primary-500 flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    active
                        ? 'border-primary-500 text-secondary-100 font-medium'
                        : 'text-secondary-400 hover:text-secondary-100'
                );
                // 현재 카테고리는 링크가 아니라 텍스트다. `<Link>`로 두면 자기
                // 자신을 가리키는 죽은 앵커가 되어 내부 링크 그래프에 자기
                // 참조가 들어간다(감사 실측: /news/stock의 내부 링크 집합에
                // '/news/stock' 포함). 형제인 `shared/ui/RegionTabs`가 이미
                // 같은 이유로 같은 형태를 쓴다 — 그쪽 JSDoc 참조.
                if (active) {
                    return (
                        <span
                            key={category}
                            aria-current="page"
                            className={className}
                        >
                            {tCat(`${category}.shortLabel`)}
                        </span>
                    );
                }
                return (
                    <Link
                        key={category}
                        href={`/news/${category}`}
                        // 카테고리 탭 전체가 한 화면에 있어 마운트 즉시 전부 prefetch된다.
                        // `_rsc` 해시가 진입 경로마다 달라 캐시 재사용이 안 되므로
                        // (docs/architecture/CDN_CACHING.md §1) 클릭 시점으로 미룬다.
                        prefetch={false}
                        className={className}
                    >
                        {tCat(`${category}.shortLabel`)}
                    </Link>
                );
            })}
        </nav>
    );
}
