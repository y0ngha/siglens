'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';

interface NavItem {
    readonly href: string;
    readonly label: string;
}

interface HeaderNavProps {
    readonly items: ReadonlyArray<NavItem>;
}

/** Client island for the primary nav; isolated so the surrounding Header can stay an RSC while `usePathname()` runs client-side. */
export function HeaderNav({ items }: HeaderNavProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
            {items.map(item => {
                const isActive =
                    pathname !== null &&
                    (pathname === item.href ||
                        pathname.startsWith(`${item.href}/`));
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        // 전역 헤더는 모든 페이지에서 렌더되므로, 기본 prefetch면 페이지뷰마다
                        // 이 링크 전부의 RSC 페이로드를 당겨온다. 그런데 그 요청 URL에 붙는
                        // `_rsc=<hash>`는 `next-router-state-tree`에서 파생돼 **진입 페이지마다
                        // 값이 다르다**(실측: `/news`가 진입점 4곳에서 해시 4종). CDN 캐시 키는
                        // URL이라 같은 목적지가 매번 다른 키로 저장돼 재사용이 안 된다 —
                        // prefetch가 캐시를 데우는 게 아니라 캐시 미스를 양산한다.
                        // 클릭 시점 fetch로 미루면 요청 수가 줄고, 엣지에 이미 있는 HTML을 쓴다.
                        // 근거·실측: docs/architecture/CDN_CACHING.md §1
                        prefetch={false}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'focus-visible:ring-primary-500 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 px-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:outline-none',
                            isActive
                                ? 'text-secondary-100 border-primary-500'
                                : 'text-secondary-400 hover:text-secondary-100 border-transparent'
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
