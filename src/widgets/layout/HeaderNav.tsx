'use client';

import { usePathname } from 'next/navigation';
import type { NavVerticalNode } from './headerNavTree';
import { HeaderNavMenu } from './HeaderNavMenu';

interface HeaderNavProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
}

/** Client island for the primary nav; isolated so the surrounding Header can stay an RSC while `usePathname()` runs client-side. */
export function HeaderNav({ items }: HeaderNavProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
            {items.map(vertical => (
                <HeaderNavMenu
                    key={vertical.id}
                    vertical={vertical}
                    idScope="nav"
                    pathname={pathname}
                />
            ))}
        </nav>
    );
}
