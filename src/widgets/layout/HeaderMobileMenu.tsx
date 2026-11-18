'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { authNextQuery } from '@/shared/lib/auth/redirect';
import { cn } from '@/shared/lib/cn';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { ContrastIcon } from '@/shared/ui/StrokeIcons';
import { ThemeRadioGroup } from '@/shared/ui/ThemeRadioGroup';
import { AiNavLink } from './AiNavLink';
import { useMobileDrawer } from './hooks/useMobileDrawer';
import { MobileAuthCta } from './ui/mobile-menu/MobileAuthCta';
import { MobileDrawerPanel } from './ui/mobile-menu/MobileDrawerPanel';
import { MobileMenuTrigger } from './ui/mobile-menu/MobileMenuTrigger';
import { MobileNavGroup } from './ui/mobile-menu/MobileNavGroup';
import { MobileNavLink } from './ui/mobile-menu/MobileNavLink';
import type { NavVerticalNode } from './utils/headerNavTree';
import { SHOW_BELOW_PHONE_BAR } from './utils/phoneBarBreakpoint';
import { isPathWithin } from './utils/navActiveState';

interface HeaderMobileMenuProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
    /**
     * 비로그인일 때만 드로어에 인증 CTA를 낸다. 로그인 상태에서는 헤더의 아바타 메뉴가
     * 계정 링크를 이미 갖고 있어 중복이다.
     */
    readonly showAuthCta?: boolean;
    /**
     * 인증 CTA의 `/login`·`/signup` href에 붙는 SSO handoff 쿼리
     * (예: `/api/auth/handoff?to=ai&next=%2F`). ai 호스트에서 드로어를 연 방문자가 로그인 뒤
     * 그곳으로 돌아오게 한다. 메인 호스트에서는 `undefined`라 href가 그대로 `/login`·`/signup`이다.
     */
    readonly authNext?: string;
}

/**
 * 모바일 햄버거 + 드로어 내비 조립.
 *
 * 열림 상태와 부수 효과는 `useMobileDrawer`, 셸은 `MobileDrawerPanel`이 맡고 여기서는 드로어
 * 안의 순서만 정한다 — (폰 폭 비회원의) 테마, 내비 그룹, 차트 가이드, AI 진입, 인증 CTA. 언어·테마의
 * 집은 헤더 계정 영역이다(비회원 文A·◐ 버튼 / 회원 아바타 메뉴). 예외 하나: 폰 폭에서는 비회원의
 * ◐ 버튼이 헤더 줄에 설 자리가 없어 테마만 여기 온다.
 * 래퍼의 `lg:hidden`은 `Header`의 데스크톱 내비 `hidden lg:flex`와 짝이다 — 한쪽만 바꾸면 두
 * 내비가 동시에 보이거나 둘 다 사라진다.
 */
export function HeaderMobileMenu({
    items,
    showAuthCta = false,
    authNext,
}: HeaderMobileMenuProps) {
    const t = useTranslations('widgets.layout');
    const authQuery = authNextQuery(authNext);
    const pathname = useAppPathname();
    const themeHeadingId = useId();
    const { isOpen, triggerRef, drawerRef, close, toggle } =
        useMobileDrawer(pathname);

    return (
        <div className="lg:hidden">
            <MobileMenuTrigger
                ref={triggerRef}
                isOpen={isOpen}
                onClick={toggle}
            />
            <MobileDrawerPanel
                drawerRef={drawerRef}
                isOpen={isOpen}
                onClose={close}
            >
                {/* 폰 폭 비회원 전용 — 헤더 줄에서 뺀 ◐ 버튼의 자리. 경계는 `HeaderPreferencesMenu`의
                    `HIDE_BELOW_PHONE_BAR`와 같다. 회원은 아바타 메뉴에 테마가 있어 그리지 않는다.
                    설정이지 내비 항목이 아니라 <nav> 밖에 둔다. */}
                {showAuthCta && (
                    <div
                        className={cn(
                            'border-b border-secondary-700 p-2',
                            SHOW_BELOW_PHONE_BAR
                        )}
                    >
                        <p
                            id={themeHeadingId}
                            className="flex items-center gap-2 px-3 pt-1 pb-1 text-xs font-medium text-secondary-400"
                        >
                            <ContrastIcon className="size-4 shrink-0" />
                            {t('preferences.theme')}
                        </p>
                        <ThemeRadioGroup labelledBy={themeHeadingId} />
                    </div>
                )}

                <nav
                    aria-label={t('HeaderMobileMenu.076925')}
                    className="overflow-y-auto overscroll-contain"
                >
                    {items.map(vertical => (
                        <MobileNavGroup
                            key={vertical.id}
                            vertical={vertical}
                            pathname={pathname}
                            onNavigate={close}
                        />
                    ))}
                    {/* 차트 가이드는 버티컬 목록의 마지막 그룹이다 — 아래 고정 영역에 두면 스크롤
                        목록이 그만큼 줄어 뉴스 하위 항목이 잘려 보인다. */}
                    <div className="border-t border-secondary-700 py-2">
                        <MobileNavLink
                            href={GUIDE_PATH}
                            label={t('HeaderMobileMenu.guideLink')}
                            active={isPathWithin(GUIDE_PATH, pathname)}
                            onNavigate={close}
                        />
                    </div>
                </nav>

                <div className="border-t border-secondary-700 p-3">
                    <AiNavLink className="w-full justify-center" />
                </div>

                {showAuthCta && (
                    <MobileAuthCta authQuery={authQuery} onNavigate={close} />
                )}
            </MobileDrawerPanel>
        </div>
    );
}
