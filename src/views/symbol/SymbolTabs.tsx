'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
    const pathname = usePathname();
    const assetInfo = useAssetInfo(symbol);
    const railRef = useRef<HTMLElement>(null);
    const activeRef = useRef<HTMLAnchorElement>(null);

    /**
     * 활성 탭을 레일 안으로 끌어온다.
     *
     * 탭이 9개라 모바일 폭에서 레일이 넘친다(실측 500px 뷰포트: `scrollWidth`
     * 653, 활성 `position` 탭 x=581, `scrollLeft` 0 → 화면 밖). 그 라우트로
     * **직접 진입한** 사용자는 자기가 어느 탭에 있는지 볼 수 없다 —
     * `aria-current`는 있으니 AT는 알지만 눈으로는 알 수 없다.
     *
     * `scrollIntoView`를 쓰지 않는 이유: 그 API는 조상 스크롤 컨테이너까지
     * 함께 움직여 페이지가 세로로 튄다. 레일의 `scrollLeft`만 직접 옮긴다.
     *
     * 이미 보이면 건드리지 않는다 — 매 내비게이션마다 중앙 정렬로 재배치하면
     * 사용자가 손으로 맞춰둔 위치를 빼앗는다.
     */
    useEffect(() => {
        const rail = railRef.current;
        const active = activeRef.current;
        if (rail === null || active === null) return;
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        const viewLeft = rail.scrollLeft;
        const viewRight = viewLeft + rail.clientWidth;
        if (left >= viewLeft && right <= viewRight) return;
        // 왼쪽으로 벗어났으면 왼쪽 끝에, 오른쪽이면 오른쪽 끝에 붙인다.
        rail.scrollLeft = left < viewLeft ? left : right - rail.clientWidth;
    }, [pathname]);

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
            aria-label="분석 종류"
            // overflow-x-auto만 두면 CSS 명세상 overflow-y가 visible→auto로 승격되고,
            // 각 탭 링크의 -mb-px가 1px 세로 오버플로를 만들어 모바일에서 원치 않는
            // 세로 스크롤(바)이 생긴다. overflow-y-hidden으로 세로 스크롤을 차단하고
            // 가로 스크롤만 유지한다.
            className="overflow-x-auto overflow-y-hidden border-b border-secondary-700"
        >
            {/* 래퍼는 폭도 여백도 갖지 않는다. 좌우 여백은 **링크 자신의 `px-4`**가
                내므로, 첫 탭 라벨이 뷰포트에서 16px에 놓여 브레드크럼·차트 제목 줄과
                같은 선에 선다. 여기에 컨테이너 패딩을 더하면 탭만 32px로 밀린다 —
                예전 `symbol-container` + `px-0` 조합이 그 상쇄를 하고 있었다.

                `min-w-max`는 탭이 뷰포트보다 넓어질 때 줄어들지 않게 해 `nav`의
                가로 스크롤을 살린다. */}
            <div className="flex min-w-max">
                {tabs.map(t => {
                    const href = t.hrefBuilder(upper);
                    const active = pathname === href;
                    return (
                        <Link
                            key={t.key}
                            ref={active ? activeRef : undefined}
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
                            {t.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
