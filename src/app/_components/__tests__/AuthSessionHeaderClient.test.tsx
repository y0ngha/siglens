// Header(presentational)를 스파이로 대체해 전달 props를 검증한다. (스파이는 vi.mock factory가
// 참조하므로 vi.hoisted로 끌어올린다 — vitest가 vi.mock과 함께 import 위로 호이스팅한다.)
const headerSpy = vi.hoisted(() => vi.fn());
const refetchSpy = vi.hoisted(() => vi.fn());
const mockPathname = vi.hoisted(() => vi.fn<() => string>());
// LocaleSwitcher는 로케일 라우터(next-intl navigation)를 요구한다. 이 테스트는
// 세션 헤더 조립만 검증하므로 stub으로 대체한다(전용 테스트가 스위처를 다룬다).
vi.mock('@/widgets/layout/LocaleSwitcher', () => ({
    LocaleSwitcher: () => null,
}));
vi.mock('@/widgets/layout/Header', () => ({
    Header: (props: unknown) => {
        headerSpy(props);
        return null;
    },
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: vi.fn(),
}));
vi.mock('@/entities/auth/hooks/useAuthHint', () => ({
    useAuthHint: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname(),
}));
// 헤더는 root QueryClientProvider 안에서 렌더되지만, 단위 테스트에선 useQueryClient를
// 스파이로 대체해 nav-trigger refetch 호출만 직접 검증한다(provider 트리 불필요).
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ refetchQueries: refetchSpy }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

const mockCurrentUser = vi.mocked(useCurrentUser);
const mockAuthHint = vi.mocked(useAuthHint);

const user: AuthUserRecord = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Alice',
    avatarUrl: null,
    tier: 'member',
    emailVerified: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

interface CapturedHeaderProps {
    authNext?: string;
    currentUser: unknown;
    loadingUserMenu?: boolean;
}

function lastHeaderProps(): CapturedHeaderProps {
    return headerSpy.mock.calls.at(-1)?.[0] as CapturedHeaderProps;
}

describe('AuthSessionHeaderClient', () => {
    beforeEach(() => {
        headerSpy.mockClear();
        refetchSpy.mockClear();
        mockCurrentUser.mockReset();
        mockAuthHint.mockReset();
        mockPathname.mockReturnValue('/');
    });

    /**
     * 조회 실패는 "로그아웃"이 아니다 — 죽은 세션은 액션이 `null`로 돌려준다. 에러는
     * 네트워크나 배포 직후 옛 빌드 탭의 Server Action 불일치다. 게스트 CTA를 그리면
     * 로그인한 회원에게 로그아웃된 것처럼 보인다(2026-09-14 사용자 제보).
     */
    it('조회 에러면 게스트로 떨어뜨리지 않고 hint 기반 로딩 셸을 유지한다', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: undefined,
            isPending: false,
            isError: true,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps()).toMatchObject({
            currentUser: null,
            loadingUserMenu: true,
        });
    });

    it('Happy: 로그인 사용자 → Header에 currentUser 전달', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: user,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toMatchObject({
            email: 'a@b.com',
            name: 'Alice',
            avatarUrl: null,
            tier: 'member',
        });
    });

    it('authReturn="ai": 로그인/가입 복귀 경로가 현재 pathname을 담은 SSO 핸드오프가 된다', () => {
        mockAuthHint.mockReturnValue(false);
        mockPathname.mockReturnValue('/en/c/abc');
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient authReturn="ai" />);
        expect(lastHeaderProps().authNext).toBe(
            '/api/auth/handoff?to=ai&next=%2Fen%2Fc%2Fabc'
        );
    });

    it('authReturn 없음(메인 호스트): authNext를 넘기지 않는다', () => {
        mockAuthHint.mockReturnValue(false);
        mockPathname.mockReturnValue('/market');
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().authNext).toBeUndefined();
    });

    it('Happy: 게스트(쿼리 resolved null, hint 없음) → currentUser=null', () => {
        mockAuthHint.mockReturnValue(false);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toBeNull();
    });

    it('pending + hint 있음 → loadingUserMenu skeleton 추정', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: undefined,
            isPending: true,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps()).toMatchObject({
            currentUser: null,
            loadingUserMenu: true,
        });
    });

    it('Worst: hint 있지만 세션 만료(resolved null) → 게스트로 정정(권한 노출 없음)', () => {
        mockAuthHint.mockReturnValue(true);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        render(<AuthSessionHeaderClient />);
        expect(lastHeaderProps().currentUser).toBeNull();
    });

    it('자가치유: 마운트 시 currentUser를 1회 refetch (서버 redirect 후 재동기화 트리거)', () => {
        mockAuthHint.mockReturnValue(false);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        mockPathname.mockReturnValue('/login');
        render(<AuthSessionHeaderClient />);
        expect(refetchSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.currentUser(),
        });
        expect(refetchSpy).toHaveBeenCalledTimes(1);
    });

    it('자가치유: navigation(경로 변경)마다 refetch — login→/ 재동기화', () => {
        mockAuthHint.mockReturnValue(false);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        mockPathname.mockReturnValue('/login');
        const { rerender } = render(<AuthSessionHeaderClient />);
        expect(refetchSpy).toHaveBeenCalledTimes(1);

        // 서버 redirect로 / 로 soft-nav → 경로 변경 → 1회 추가 refetch
        mockPathname.mockReturnValue('/');
        rerender(<AuthSessionHeaderClient />);
        expect(refetchSpy).toHaveBeenCalledTimes(2);
    });

    it('자가치유: 같은 경로 재렌더는 refetch하지 않음 (ref 가드)', () => {
        mockAuthHint.mockReturnValue(false);
        mockCurrentUser.mockReturnValue({
            data: null,
            isPending: false,
        } as never);
        mockPathname.mockReturnValue('/AAPL');
        const { rerender } = render(<AuthSessionHeaderClient />);
        rerender(<AuthSessionHeaderClient />);
        expect(refetchSpy).toHaveBeenCalledTimes(1);
    });
});
