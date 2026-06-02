// Header(presentational)를 스파이로 대체해 전달 props를 검증한다. (스파이는 vi.mock factory가
// 참조하므로 vi.hoisted로 끌어올린다 — vitest가 vi.mock과 함께 import 위로 호이스팅한다.)
const headerSpy = vi.hoisted(() => vi.fn());
vi.mock('@/widgets/layout/Header', () => ({
    Header: (props: unknown) => {
        headerSpy(props);
        return null;
    },
}));
vi.mock('@/entities/session', () => ({
    useCurrentUser: vi.fn(),
    useAuthHint: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { useCurrentUser, useAuthHint } from '@/entities/session';

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
        mockCurrentUser.mockReset();
        mockAuthHint.mockReset();
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
});
