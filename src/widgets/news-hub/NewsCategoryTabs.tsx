/**
 * @file `/news/[category]` 페이지의 같은 지역 카테고리 탭 줄.
 */
import { useTranslations } from 'next-intl';
import { buildCategoryTabs, type CategoryTabItem } from './utils/categoryTabs';
import { CategoryTab } from './ui/tabs/CategoryTab';

interface NewsCategoryTabsProps {
    /** The category currently being viewed — rendered as the active tab. */
    readonly activeCategory: CategoryTabItem['category'];
}

/**
 * Category navigation strip for /news/[category] pages. URL-based nav (links +
 * aria-current), not a tablist — each tab is a real page. Mirrors `SymbolTabs`:
 * `overflow-x-auto` + `whitespace-nowrap` so the labels scroll horizontally
 * on narrow viewports (375px) instead of wrapping or overflowing the layout.
 *
 * **같은 지역의 카테고리만 나열하고, 지역에 카테고리가 하나뿐이면(한국·암호화폐)
 * 아무것도 렌더하지 않는다** — 판정과 이유는 `buildCategoryTabs` 참조.
 *
 * Server component (the active tab is known from the route param), so it adds
 * no client JS — `usePathname` is unnecessary.
 */
export function NewsCategoryTabs({ activeCategory }: NewsCategoryTabsProps) {
    const t = useTranslations('widgets.news-hub');
    // 카테고리 라벨은 `entities.market-news.category`가 단일 소스다 —
    // 위젯에 한국어 테이블을 따로 두면 두 곳이 갈린다.
    const tCat = useTranslations('entities.market-news.category');
    const tabs = buildCategoryTabs(activeCategory);
    if (tabs.length === 0) return null;

    return (
        <nav
            aria-label={t('NewsCategoryTabs.ab8544')}
            className="flex overflow-x-auto border-b border-secondary-700"
        >
            {tabs.map(tab => (
                <CategoryTab
                    key={tab.category}
                    tab={tab}
                    label={tCat(tab.labelKey)}
                />
            ))}
        </nav>
    );
}
