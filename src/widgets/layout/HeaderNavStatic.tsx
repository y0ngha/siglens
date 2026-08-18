import type { NavVerticalNode } from './headerNavTree';
import { HeaderNavMenu } from './HeaderNavMenu';

interface HeaderNavStaticProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
}

/**
 * Static HeaderNav fallback — `usePathname` 없이 PPR prerender shell이 정적으로
 * 완료되도록 하는 Suspense fallback.
 *
 * `HeaderNav`와 **같은 `HeaderNavMenu`를 렌더한다.** 예전에는 이쪽이 단순 링크
 * 목록이라 마크업이 갈렸는데, 지금은 지역 링크가 드롭다운 패널 안에 있어서
 * fallback이 축약형이면 정적 셸에서 신규 지역 페이지로 가는 앵커가 통째로 빠진다 —
 * 크롤러가 보는 것이 바로 그 정적 셸이다. 활성 표시(`pathname`)만 없는 동일 마크업.
 */
export function HeaderNavStatic({ items }: HeaderNavStaticProps) {
    return (
        <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
            {items.map(vertical => (
                <HeaderNavMenu
                    key={vertical.id}
                    vertical={vertical}
                    pathname={null}
                />
            ))}
        </nav>
    );
}
