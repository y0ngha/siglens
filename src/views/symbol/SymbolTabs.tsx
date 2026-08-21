'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { cn } from '@/shared/lib/cn';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import {
    DEFAULT_MARKET_PROFILE,
    marketProfileOf,
} from '@/shared/config/marketProfile';
import { tabsFor } from './utils/symbolTabsConfig';

interface SymbolTabsProps {
    /** Ticker symbol. Will be uppercased internally. */
    symbol: string;
}

/** Header nav strip for the 4 analysis pages of a symbol. Uses nav + aria-current (URL-based, not tablist). */
export function SymbolTabs({ symbol }: SymbolTabsProps) {
    const t = useTranslations('views.symbol');
    // 탭 href(`/AAPL/news`)는 로케일 접두사가 없다. 접두사가 붙은 경로로
    // 비교하면 en/ja/zh에서 활성 탭 표시와 `aria-current`가 통째로 꺼진다.
    const pathname = useAppPathname();
    // 전용 네임스페이스 — 키가 배열에서 오므로 추출기에는 동적 조회다.
    // `manualKeys.preserve`에 `shared.symbolTab`이 등록돼 있어야 유지된다.
    //
    // 아래 로딩 분기(`assetInfo === undefined`)보다 **위**여야 한다. 그 뒤에
    // 두면 로딩 렌더에서만 훅이 하나 줄어 훅 순서가 깨진다.
    const tTab = useTranslations('shared.symbolTab');
    const assetInfo = useAssetInfo(symbol);

    const upper = symbol.toUpperCase();

    // Loading state: assetInfo === undefined means the RQ query is still in-flight.
    // Render a placeholder that matches the tab bar height/border so there is no
    // layout shift when the real tabs appear.
    if (assetInfo === undefined) {
        return <div className="h-11 border-b border-secondary-700" />;
    }

    /**
     * Null = unknown symbol (the query resolved but found no matching asset).
     * Default to the us-equity profile so we show the full tab set rather than
     * a blank nav — the tab bar is still functional for any valid equity route.
     */
    const profile =
        assetInfo !== null
            ? marketProfileOf(assetInfo)
            : DEFAULT_MARKET_PROFILE;
    const tabs = tabsFor(profile);

    return (
        <nav
            aria-label={t('SymbolTabs.765f05')}
            // overflow-x-auto만 두면 CSS 명세상 overflow-y가 visible→auto로 승격되고,
            // 각 탭 링크의 -mb-px가 1px 세로 오버플로를 만들어 모바일에서 원치 않는
            // 세로 스크롤(바)이 생긴다. overflow-y-hidden으로 세로 스크롤을 차단하고
            // 가로 스크롤만 유지한다.
            className="flex overflow-x-auto overflow-y-hidden border-b border-secondary-700"
        >
            {tabs.map(tab => {
                const href = tab.hrefBuilder(upper);
                const active = pathname === href;
                return (
                    <Link
                        key={tab.key}
                        href={href}
                        // 탭은 전부 같은 심볼의 형제 라우트라 viewport에 동시에 들어온다.
                        // 기본 prefetch는 마운트 즉시 탭 수만큼 RSC 페이로드를 당겨오는데,
                        // 종목 라우트 페이로드는 개당 0.9~2.7MB다(2026-08-12 실측). 한 번의
                        // 클릭을 위해 페이지뷰마다 ~10MB를 origin에서 끌어오는 셈이고, 그
                        // 요청은 전부 `cf-cache-status: DYNAMIC`(엣지 우회)이라 CDN 히트율까지
                        // 같이 깎는다. 클릭 시점 fetch로 미루고 엣지 캐시가 받아내게 한다.
                        // 근거·측정: docs/architecture/CDN_CACHING.md §1
                        prefetch={false}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'focus-visible:ring-primary-500 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            active
                                ? 'border-primary-500 text-secondary-100 font-medium'
                                : 'text-secondary-400 hover:text-secondary-100'
                        )}
                    >
                        {tTab(tab.labelKey)}
                    </Link>
                );
            })}
        </nav>
    );
}
