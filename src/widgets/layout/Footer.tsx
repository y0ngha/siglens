import { useTranslations } from 'next-intl';
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
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { Fragment } from 'react';

/**
 * 푸터에 거는 목적지 = 모든 지역 링크 + 지역에 속하지 않는 상위 페이지(`/news`).
 *
 * 지역 링크만 걸면 `/news` 허브가 사이트 안에서 보이는 앵커를 하나도 못 갖는다 —
 * 헤더 드롭다운은 `hidden lg:flex` + `invisible` 안이라 그 자리를 대신하지 못한다.
 */
const FOOTER_NAV_LINKS = [...NAV_OVERVIEW_LINKS, ...ALL_NAV_REGION_LINKS];

export function Footer() {
    const t = useTranslations('widgets.layout');
    // 내비 라벨 키는 네임스페이스까지 포함된 완전 수식 키라 루트로 푼다.
    const tNav = useTranslations();
    return (
        <footer className="border-t border-secondary-800">
            <div className="flex flex-col gap-2 px-6 py-6 lg:px-[15vw]">
                <div
                    role="note"
                    aria-label={t('Footer.693b62')}
                    className="text-xs leading-relaxed text-secondary-400 sm:text-sm"
                >
                    {INVESTMENT_DISCLAIMER}
                </div>
                <div className="flex flex-col items-center gap-3 border-secondary-800 sm:flex-row sm:justify-between">
                    <p className="text-sm text-secondary-400">
                        © <CurrentYear /> Siglens
                    </p>
                    <nav
                        aria-label={t('Footer.5f5d12')}
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
                                    {tNav(item.fullLabelKey)}
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
                            triggerLabel={t('Footer.531f6a')}
                            triggerClassName="text-secondary-400 hover:text-secondary-200 text-sm transition-colors"
                        />
                    </nav>
                </div>
            </div>
        </footer>
    );
}
