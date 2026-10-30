import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';

interface MobileNavLinkProps {
    readonly href: string;
    readonly label: string;
    readonly active: boolean;
    readonly onNavigate: () => void;
    readonly indented?: boolean;
}

/**
 * 드로어의 링크 한 줄. 지역과 그 하위 목적지가 같은 컴포넌트를 쓴다(들여쓰기만 다름).
 *
 * 한글 메뉴 라벨이라 0.12em 자간을 걷어내고, 탭 타깃이기도 해 14px로 올린다. `prefetch`는
 * 끈다 — 진입 페이지마다 다른 `_rsc` 해시가 CDN 캐시를 파편화시킨다.
 */
export function MobileNavLink({
    href,
    label,
    active,
    onNavigate,
    indented = false,
}: MobileNavLinkProps) {
    return (
        <Link
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
                'focus-visible:ring-primary-500 flex min-h-11 w-full touch-manipulation items-center py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                indented
                    ? 'pr-4 pl-8 font-normal text-secondary-500 hover:text-secondary-200'
                    : 'px-4 font-semibold',
                active
                    ? 'text-secondary-100 border-primary-500 border-l-2'
                    : cn(
                          'border-l-2 border-transparent',
                          !indented &&
                              'text-secondary-400 hover:text-secondary-100'
                      )
            )}
        >
            {label}
        </Link>
    );
}
