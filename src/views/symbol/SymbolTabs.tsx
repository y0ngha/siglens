'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import {
    DEFAULT_MARKET_PROFILE,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { tabsFor } from './utils/symbolTabsConfig';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { usePendingSymbolTab } from './SymbolTabPendingContext';
import { useSymbolTabLabels } from './hooks/useSymbolTabLabels';
import { useKeepActiveTabInRail } from './hooks/useKeepActiveTabInRail';

interface SymbolTabsProps {
    /** Ticker symbol. Will be uppercased internally. */
    symbol: string;
}

/**
 * 탭 링크 클래스.
 *
 * 포커스 링은 **안쪽**(`ring-inset`)에 그린다. 레일이 `overflow-x-auto overflow-y-hidden`
 * 스크롤 컨테이너이고 링크가 레일 높이를 꽉 채우므로, 바깥 링(+offset)은 위·아래가
 * 컨테이너에 잘리고 첫 탭은 왼쪽까지 잘린다.
 */
const TAB_LINK_CLASS =
    '-mb-px flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset focus-visible:outline-none';

/** Header nav strip for the analysis pages of a symbol. Uses nav + aria-current (URL-based, not tablist). */
export function SymbolTabs({ symbol }: SymbolTabsProps) {
    const t = useTranslations('views.symbol');
    // 탭 href(`/AAPL/news`)는 로케일 접두사가 없다. 접두사가 붙은 경로로
    // 비교하면 en/ja/zh에서 활성 탭 표시와 `aria-current`가 통째로 꺼진다.
    const pathname = useAppPathname();
    // 아래 로딩 분기(`assetInfo === undefined`)보다 **위**여야 한다. 그 뒤에
    // 두면 로딩 렌더에서만 훅이 줄어 훅 순서가 깨진다.
    const tabLabels = useSymbolTabLabels();
    const assetInfo = useAssetInfo(symbol);
    const pendingHref = usePendingSymbolTab();
    const { railRef, activeRef } = useKeepActiveTabInRail(pathname);

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
            ref={railRef}
            aria-label={t('SymbolTabs.765f05')}
            // overflow-x-auto만 두면 CSS 명세상 overflow-y가 visible→auto로 승격되고,
            // 각 탭 링크의 -mb-px가 1px 세로 오버플로를 만들어 모바일에서 원치 않는
            // 세로 스크롤(바)이 생긴다. overflow-y-hidden으로 세로 스크롤을 차단하고
            // 가로 스크롤만 유지한다.
            className="overflow-x-auto overflow-y-hidden border-b border-secondary-700"
        >
            {/* 래퍼는 폭도 여백도 갖지 않는다. 좌우 여백은 **링크 자신의 `px-4`**가
                내므로, 첫 탭 라벨이 뷰포트에서 16px에 놓여 브레드크럼·차트 제목 줄과
                같은 선에 선다. 여기에 컨테이너 패딩을 더하면 탭만 32px로 밀린다.

                `min-w-max`는 탭이 뷰포트보다 넓어질 때 줄어들지 않게 해 `nav`의
                가로 스크롤을 살린다. */}
            <div className="flex min-w-max">
                {tabs.map(tab => {
                    const href = tab.hrefBuilder(upper);
                    const active = pathname === href;
                    // 누른 탭을 RSC가 오기 전에 먼저 활성으로 칠한다. aria-current는
                    // 실제 경로 기준으로 둔다 — 이동이 끝나기 전엔 아직 그 페이지가 아니다.
                    const highlighted =
                        pendingHref === null ? active : pendingHref === href;
                    return (
                        <Link
                            key={tab.key}
                            ref={active ? activeRef : undefined}
                            href={href}
                            // 탭은 전부 같은 심볼의 형제 라우트라 viewport에 동시에 들어온다.
                            // 기본 prefetch는 마운트 즉시 탭 수만큼 RSC 페이로드(종목 라우트는
                            // 개당 수 MB)를 당겨오고, 그 요청은 엣지 캐시를 우회한다. 클릭 시점
                            // fetch로 미루고 엣지 캐시가 받아내게 한다.
                            prefetch={false}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                TAB_LINK_CLASS,
                                highlighted
                                    ? 'border-primary-500 font-medium text-secondary-100'
                                    : 'text-secondary-400 hover:text-secondary-100'
                            )}
                        >
                            {tabLabels[tab.key]}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
