// Header(presentational)를 스파이로 대체해 전달 props를 검증한다. (스파이는 vi.mock factory가
// 참조하므로 vi.hoisted로 끌어올린다 — vitest가 vi.mock과 함께 import 위로 호이스팅한다.)
const headerSpy = vi.hoisted(() => vi.fn());
const refetchSpy = vi.hoisted(() => vi.fn());
const mockPathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock('@/widgets/layout/Header', () => ({
    Header: (props: unknown) => {
        headerSpy(props);
        return null;
    },
}));
vi.mock('@/entities/auth', () => ({
    useCurrentUser: vi.fn(),
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
import { useCurrentUser, useAuthHint } from '@/entities/auth';
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
