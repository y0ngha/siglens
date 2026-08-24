import { ContactDialog } from './ContactDialog';
import { CurrentYear } from './CurrentYear';
import {
    ALL_NAV_REGION_LINKS,
    NAV_OVERVIEW_LINKS,
} from '@/shared/config/assetClassNav';
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

/**
 * 푸터에 거는 목적지 = 모든 지역 링크 + 지역에 속하지 않는 상위 페이지(`/news`).
 *
 * 지역 링크만 걸면 `/news` 허브가 사이트 안에서 보이는 앵커를 하나도 못 갖는다 —
 * 헤더 드롭다운은 `hidden lg:flex` + `invisible` 안이라 그 자리를 대신하지 못한다.
 */
const FOOTER_NAV_LINKS = [...NAV_OVERVIEW_LINKS, ...ALL_NAV_REGION_LINKS];

export function Footer() {
    return (
        <footer className="border-t border-secondary-800">
            <div className="page-container flex flex-col gap-2 py-6">
                <div
                    role="note"
                    aria-label="투자 면책 고지"
                    className="text-xs leading-relaxed text-secondary-400 sm:text-sm"
                >
                    {INVESTMENT_DISCLAIMER}
                </div>
                <div className="flex flex-col items-center gap-3 border-secondary-800 sm:flex-row sm:justify-between">
                    {/* `shrink-0` + `whitespace-nowrap`: 오른쪽 nav가 링크 12개짜리
                        `flex-wrap`이라 폭을 크게 요구한다. 그대로 두면 `justify-between`
                        아래에서 이 짧은 저작권 표기가 대신 밀려 `© 2026` / `Siglens`
                        두 줄로 쪼개진다(2026-08-25 사용자 제보 스크린샷). 줄바꿈은
                        긴 쪽(nav)이 감당해야 한다. */}
                    <p className="shrink-0 text-sm whitespace-nowrap text-secondary-400">
                        © <CurrentYear /> Siglens
                    </p>
                    <nav
                        aria-label="사이트 정보"
                        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
                    >
                        {/*
                            푸터는 버티컬 그룹핑 없이 평탄하게 나열하므로 짧은 라벨
                            (`미국`/`한국`)이 아니라 `fullLabel`을 쓴다 — 짧은 라벨만
                            쓰면 `미국 · 한국 · 미국 · 한국`이 되어 뜻을 잃는다.
                        */}
                        {FOOTER_NAV_LINKS.map(item => (
                            <Fragment key={item.href}>
                                <Link
                                    href={item.href}
                                    // 전역 푸터 — 모든 페이지에서 렌더된다. prefetch는 진입
                                    // 페이지마다 다른 `_rsc` 해시를 만들어 캐시를 파편화시킨다
                                    // (docs/architecture/CDN_CACHING.md §1).
                                    prefetch={false}
                                    className="text-sm text-secondary-400 transition-colors hover:text-secondary-200"
                                >
                                    {item.fullLabel}
                                </Link>
                                <DotSeparator />
                            </Fragment>
                        ))}
                        <Link
                            href={PRIVACY_PATH}
                            // 위 FOOTER_NAV_LINKS와 동일 — 전역 푸터의 `_rsc` 파편화
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className="text-sm text-secondary-400 transition-colors hover:text-secondary-200"
                        >
                            {PRIVACY_TITLE}
                        </Link>
                        <DotSeparator />
                        <Link
                            href={TERMS_PATH}
                            // 위 FOOTER_NAV_LINKS와 동일 — 전역 푸터의 `_rsc` 파편화
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            className="text-sm text-secondary-400 transition-colors hover:text-secondary-200"
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
