'use client';

import { useId } from 'react';
import { authNextQuery } from '@/shared/lib/auth/redirect';
import { HeaderPreferencesMenu } from './HeaderPreferencesMenu';
import { usePopoverDisclosure } from './hooks/usePopoverDisclosure';
import type { HeaderUserMenuUser } from './types';
import { GuestAuthLinks } from './ui/user-menu/GuestAuthLinks';
import { UserAvatarButton } from './ui/user-menu/UserAvatarButton';
import { UserMenuPanel } from './ui/user-menu/UserMenuPanel';
import { UserMenuSkeleton } from './ui/user-menu/UserMenuSkeleton';

interface HeaderUserMenuProps {
    /** 현재 사용자. 비로그인이면 `null`. 헤더에서 서버 측으로 조회한다. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * `true`면 로그인/회원가입 버튼 대신 스켈레톤을 그린다. 힌트 쿠키가 로그인 상태를
     * 가리키는데 DB 조회가 아직 진행 중일 때의 안쪽 Suspense fallback이다.
     */
    readonly loading?: boolean;
    /**
     * `/login`·`/signup` href에 붙는 SSO handoff 쿼리(예: `/api/auth/handoff?to=ai&next=%2F`).
     * ai 호스트에서 온 방문자가 로그인 뒤 그곳으로 돌아오게 한다. 메인 호스트에서는 `undefined`.
     */
    readonly authNext?: string;
}

/**
 * 헤더 우측 계정 영역 — 스켈레톤 / 게스트(文A·◐ 버튼 + CTA) / 로그인 사용자 메뉴 중 하나를
 * 그린다. 언어·테마 설정이 계정 영역에 사는 이유: 회원은 아바타 메뉴 안의 두 줄에서, 비회원은 그
 * 자리의 文A·◐ 버튼에서 같은 두 설정을 쓴다.
 *
 * 사용자 메뉴는 Disclosure Navigation 패턴이다: 아바타 버튼이 `aria-expanded`로 상태를
 * 알리고 패널은 평범한 링크 목록이다. Escape로 닫으면 포커스가 패널 안에 있었을 때만 버튼으로
 * 되돌린다.
 */
export function HeaderUserMenu({
    currentUser,
    loading,
    authNext,
}: HeaderUserMenuProps) {
    const authQuery = authNextQuery(authNext);
    const { containerRef, triggerRef, isOpen, close, toggle } =
        usePopoverDisclosure();
    const panelId = useId();

    if (loading) return <UserMenuSkeleton />;
    if (!currentUser) {
        // 회원 추정(`<html data-auth-hint="member">`)이면 첫 페인트부터 CSS가 이 묶음 전체를
        // 숨긴다(`globals.css`) — 회원은 같은 설정을 아바타 메뉴에서 쓴다.
        return (
            <div data-header-guest-cta="" className="flex items-center gap-2">
                <HeaderPreferencesMenu />
                <GuestAuthLinks authQuery={authQuery} />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <UserAvatarButton
                ref={triggerRef}
                user={currentUser}
                isOpen={isOpen}
                panelId={panelId}
                onClick={toggle}
            />
            {isOpen ? (
                <UserMenuPanel
                    id={panelId}
                    user={currentUser}
                    onNavigate={close}
                />
            ) : null}
        </div>
    );
}
