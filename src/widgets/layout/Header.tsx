import { useTranslations } from 'next-intl';
import { HeaderMobileMenu } from './HeaderMobileMenu';
import { LocaleSwitcher } from './LocaleSwitcher';
import { LOCALE_SWITCHER_VISIBLE } from '@/shared/i18n/locales';
import { HeaderNav } from './HeaderNav';
import { HeaderNavStatic } from './HeaderNavStatic';
import { HeaderUserMenu, type HeaderUserMenuUser } from './HeaderUserMenu';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { NAV_TREE } from './headerNavTree';
import { HeaderSearch } from '@/features/ticker-search';
import { SITE_NAME } from '@/shared/lib/seo';
import Image from 'next/image';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { Suspense } from 'react';

interface HeaderProps {
    /** Resolved current user (server-fetched in `app/layout.tsx`); null for guests. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * When true, renders a skeleton for the user menu instead of its real content.
     * Used as the Suspense fallback:
     *   - outer fallback: always true (hint cookie not yet read)
     *   - inner fallback: true only when the hint cookie signals an active session
     */
    readonly loadingUserMenu?: boolean;
}

/** Presentational shell; receives resolved current user as a prop so layer rules forbid direct infrastructure access here. */
// 최상위 <header>는 암시적으로 role="banner"이므로 role을 명시하지 않는다(중복 ARIA).
export function Header({ currentUser, loadingUserMenu }: HeaderProps) {
    const t = useTranslations('widgets.layout');
    return (
        <header className="sticky top-0 z-50 border-b border-secondary-700 bg-secondary-900/90 backdrop-blur-md supports-backdrop-filter:bg-secondary-900/75">
            {/* 전역 크롬은 **뷰포트에** 맞춘다(전폭 `px-4`). 심볼 페이지의
                브레드크럼·탭·차트 제목이 모두 16px에 서 있으므로 헤더 로고도
                같은 선에 둬야 제품의 주 표면에서 좌측이 하나로 읽힌다.
                본문이 `page-container`(1200px 중앙)인 라우트에서는 로고가
                본문보다 바깥에서 시작하는데, 크롬은 전폭·본문은 읽기 폭이라는
                규약을 고른 결과다(`docs/conventions/DESIGN.md` §폭 규약).
                푸터도 같은 규약을 쓴다. */}
            <div className="flex h-14 items-center gap-2 px-4 sm:gap-4">
                <Link
                    href="/"
                    title={t('Header.d8c261')}
                    // 전역 헤더 로고 — 모든 페이지에서 렌더된다. prefetch는 진입 페이지마다
                    // 다른 `_rsc` 해시를 만들어 `/`의 캐시를 파편화시킨다
                    // (docs/architecture/CDN_CACHING.md §1).
                    prefetch={false}
                    // Visible brand text is `text-...uppercase` (renders "SIGLENS"),
                    // so the accessible name must match what users see (WCAG 2.5.3).
                    aria-label={t('Header.homeLabel', {
                        v0: SITE_NAME.toUpperCase(),
                    })}
                    className="-mx-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {/*
                        icon96.png(96×96)을 24×24로 렌더 — Lighthouse의
                        `image-size-responsive` audit이 1.5× DPI(36×36) 기준으로
                        검증하므로 source가 display의 최소 1.5× 이상이어야 한다.
                        `unoptimized`를 제거해 next/image가 24/48 responsive 변형을
                        자동 생성·서빙하도록 한다(WebP 변환 포함, 실제 전송 바이트는
                        원본보다 작다).
                    */}
                    <Image
                        src="/icon96.png"
                        alt={t('Header.1ebe53')}
                        width={24}
                        height={24}
                        className="h-6 w-6"
                        priority
                    />
                    <span
                        translate="no"
                        className="hidden font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 uppercase sm:inline"
                    >
                        {SITE_NAME}
                    </span>
                </Link>
                {/*
                    Desktop nav — PPR: Suspense fallback renders the static version.

                    브레이크포인트가 `lg`(1024px)인 것은 의도다. 헤더는 고정 `h-14`
                    한 줄이고 로고·검색·인증 메뉴가 같은 줄을 나눠 쓰는데, 내비
                    라벨에 시장("미국")이 붙으면서 폭이 늘었다. `md`(768px)에 두면
                    768~896px 구간에서 한글이 글자 단위로 줄바꿈돼 링크 높이가
                    82px가 되고 56px 행 위아래로 삐져나간다(768px 실측).
                    `HeaderMobileMenu`의 `lg:hidden`과 **반드시 같은 값**이어야
                    한다 — 어긋나면 둘 다 보이거나 둘 다 사라진다.

                    2026-08 지역 드롭다운 도입으로 라벨에서 "미국"이 빠져 폭이
                    다시 줄었지만(`시장 분석`·`뉴스`·`경제`), `md` 복귀는 실측
                    전까지 하지 않는다 — 드롭다운 트리거에 caret(▾)이 붙어
                    항목당 폭이 라벨 길이만으로 결정되지 않는다.
                */}
                <div className="hidden lg:flex">
                    <Suspense fallback={<HeaderNavStatic items={NAV_TREE} />}>
                        <HeaderNav items={NAV_TREE} />
                    </Suspense>
                </div>
                {/* 모바일은 아이콘 트리거 + 전체화면 오버레이, 데스크톱은 기존 인라인
                    자동완성. 폭 계약(`ml-auto`)까지 이 컴포넌트가 소유한다 —
                    `features/ticker-search/ui/HeaderSearch` JSDoc 참고. */}
                <HeaderSearch />
                {/*
                    모바일 갭이 **행 갭(`gap-2`)과 같아야** 한다. 검색 트리거와
                    햄버거는 이 div의 형제라 행 갭을 쓰는데, 안쪽만 다른 값을
                    쓰면 아이콘 넷의 간격이 2·8·2·8로 어긋나 보인다(사용자 제보).
                    데스크톱은 라벨이 붙어 폭이 커지므로 좁은 갭이 낫다.
                */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-0.5">
                    {/* 모바일에서도 노출한다 — 드로어 안에도 같은 스위처가
                        있지만, 언어 전환을 쓰려고 햄버거를 여는 것은 한 홉이
                        더 든다. 검색·언어·테마 세 아이콘이 같은 줄에 선다. */}
                    {LOCALE_SWITCHER_VISIBLE && <LocaleSwitcher />}
                    <ThemeToggle />
                    <HeaderUserMenu
                        currentUser={currentUser}
                        loading={loadingUserMenu}
                    />
                </div>
                {/* Mobile hamburger — hidden on desktop */}
                <HeaderMobileMenu
                    items={NAV_TREE}
                    showAuthCta={currentUser === null && !loadingUserMenu}
                />
            </div>
        </header>
    );
}
