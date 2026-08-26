import Link from 'next/link';
import { cn } from '@/shared/lib/cn';
import {
    regionsOf,
    type NavRegionId,
    type NavVerticalId,
} from '@/shared/config/assetClassNav';

interface RegionTabsProps {
    /** 어느 버티컬의 지역 목록을 그릴지. */
    readonly vertical: NavVerticalId;
    /** 현재 페이지가 속한 지역 — 이 탭이 활성 스타일을 받는다. */
    readonly active: NavRegionId;
    /**
     * 현재 페이지의 경로. 지역 탭 중 **이 경로와 정확히 같은 것만** 링크 대신
     * `aria-current` 텍스트가 된다.
     *
     * `active`와 따로 받는 이유: 지역에 속하지만 지역 허브는 **아닌** 페이지가 있다.
     * `/news/general`은 `region === 'us'`지만 `/news/us`가 아니다. 둘을 하나로 묶으면
     * 그 네 페이지가 (a) 현재 페이지가 아닌 URL에 `aria-current="page"`를 붙이고
     * (b) 자기 지역 허브로 가는 링크를 잃는다.
     */
    readonly currentPath: string;
    readonly className?: string;
}

/**
 * 페이지 상단 지역 전환 탭(미국 | 한국 | 암호화폐).
 *
 * **왜 URL 구조를 바꾸는 대신 탭인가**: `/market`·`/economy`·`/fear-greed`는 이미
 * 색인돼 순위를 가진 URL이다. 이들을 허브로 바꾸거나 `/market/us`로 리다이렉트하면
 * 축적된 신호를 버린다. 미국을 기존 URL에 그대로 두고, 지역 전환은 이 탭이 맡는다 —
 * URL은 안 흔들리고 UX는 네 버티컬에서 동일해진다.
 *
 * 서버 컴포넌트다. 활성 지역은 페이지가 자기 자신을 알고 있으므로 `usePathname`이
 * 필요 없다 — 클라이언트 번들을 늘리지 않고 크롤러도 전 지역 앵커를 본다.
 *
 * 활성 탭은 `<span aria-current="page">`로 렌더한다. 현재 페이지로 가는 링크는
 * 클릭해도 아무 일이 없는 죽은 앵커이고, 내부 링크 그래프에서 자기 참조를 만든다.
 */
export function RegionTabs({
    vertical,
    active,
    currentPath,
    className,
}: RegionTabsProps) {
    const regions = regionsOf(vertical);
    const baseClass =
        'flex min-h-11 touch-manipulation items-center rounded-lg px-3 text-sm font-semibold transition-colors';

    return (
        <nav
            aria-label="지역 선택"
            className={cn(
                'flex flex-wrap items-center gap-1 rounded-lg border border-secondary-700 bg-secondary-800/30 p-1',
                className
            )}
        >
            {regions.map(region =>
                region.href === currentPath ? (
                    <span
                        key={region.region}
                        aria-current="page"
                        className={cn(
                            baseClass,
                            'bg-secondary-700 text-secondary-100'
                        )}
                    >
                        {region.label}
                    </span>
                ) : (
                    <Link
                        key={region.region}
                        href={region.href}
                        // 지역 탭은 모든 버티컬 페이지 상단에 렌더된다. prefetch를 켜면
                        // 같은 목적지에 대해 진입 페이지마다 다른 `_rsc` 키가 쌓여
                        // CDN 캐시가 파편화된다 (docs/architecture/CDN_CACHING.md §1).
                        prefetch={false}
                        className={cn(
                            baseClass,
                            'hover:bg-secondary-800 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                            // 카테고리 페이지에서 자기 지역 허브 탭은 링크로 남되
                            // 어느 지역에 있는지는 계속 보여야 한다.
                            region.region === active
                                ? 'bg-secondary-700/60 text-secondary-100'
                                : 'text-secondary-400'
                        )}
                    >
                        {region.label}
                    </Link>
                )
            )}
        </nav>
    );
}
