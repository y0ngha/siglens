import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import { NAV_ITEMS } from './headerNavItems';
import { DotSeparator } from '@/shared/ui/DotSeparator';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/shared/lib/legal';
import Link from 'next/link';
import { Fragment } from 'react';

export function Footer() {
    return (
        <footer className="border-secondary-800 border-t">
            <div className="flex flex-col gap-2 px-6 py-6 lg:px-[15vw]">
                <div
                    role="note"
                    aria-label="투자 면책 고지"
                    className="text-secondary-400 text-xs leading-relaxed sm:text-sm"
                >
                    {INVESTMENT_DISCLAIMER}
                </div>
                <div className="border-secondary-800 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <p className="text-secondary-400 text-sm">
                        © <CurrentYear /> Siglens
                    </p>
                    <nav
                        aria-label="사이트 정보"
                        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
                    >
                        {NAV_ITEMS.map(item => (
                            <Fragment key={item.href}>
                                <Link
                                    href={item.href}
                                    // 전역 푸터 — 모든 페이지에서 렌더된다. prefetch는 진입
                                    // 페이지마다 다른 `_rsc` 해시를 만들어 캐시를 파편화시킨다
                                    // (docs/architecture/CDN_CACHING.md §1).
                                    prefetch={false}
                                    className="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                                >
                                    {item.label}
                                </Link>
                                <DotSeparator />
                            </Fragment>
                        ))}
                        <Link
                            href={PRIVACY_PATH}
                            // 위 NAV_ITEMS와 동일 — 전역 푸터의 `_rsc` 파편화
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                        >
                            {PRIVACY_TITLE}
                        </Link>
                        <DotSeparator />
                        <Link
                            href={TERMS_PATH}
                            // 위 NAV_ITEMS와 동일 — 전역 푸터의 `_rsc` 파편화
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                        >
                            {TERMS_TITLE}
                        </Link>
                        <DotSeparator />
                        <ContactDialog
                            triggerLabel="문의하기"
                            triggerClassName="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                        />
                    </nav>
                </div>
            </div>
        </footer>
    );
}
