'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface GuestAuthLinksProps {
    /** `/login`·`/signup` href 뒤에 붙는 쿼리(`?next=…`). 없으면 빈 문자열. */
    readonly authQuery: string;
}

/**
 * 비로그인 방문자의 로그인/회원가입 CTA.
 *
 * 전역 헤더라 비로그인 방문자의 모든 페이지뷰에 렌더되며, `prefetch`는 끈다 —
 * 진입 페이지마다 다른 `_rsc` 해시가 CDN 캐시를 파편화시켜 미스만 쌓인다.
 * 회원 추정(`<html data-auth-hint="member">`)이면 첫 페인트부터 CSS가 이 묶음을 숨긴다.
 */
export function GuestAuthLinks({ authQuery }: GuestAuthLinksProps) {
    const t = useTranslations('widgets.layout');
    return (
        <nav
            aria-label={t('HeaderUserMenu.ce7156')}
            data-header-guest-cta=""
            className="flex items-center gap-2"
        >
            <Link
                href={`/login${authQuery}`}
                prefetch={false}
                className="hidden min-h-11 items-center rounded px-3 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:inline-flex"
            >
                {t('HeaderUserMenu.e225a6')}
            </Link>
            {/* 모바일에서는 숨긴다 — 좁은 한 줄에 검색·언어·테마·햄버거가 이미 서 있다.
                그 폭의 진입점은 드로어 바닥의 같은 CTA가 맡는다. */}
            <Link
                href={`/signup${authQuery}`}
                prefetch={false}
                className="hidden min-h-11 items-center rounded bg-primary-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:inline-flex"
            >
                {t('HeaderUserMenu.ecb4cc')}
            </Link>
        </nav>
    );
}
