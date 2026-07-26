import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetCurrentUser, mockResolveTierOnly } = vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockResolveTierOnly: vi.fn(),
}));

vi.mock('../lib/getCurrentUser', () => ({
    getCurrentUser: mockGetCurrentUser,
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierOnly: mockResolveTierOnly,
}));

import { resolveCallerTier } from '../lib/resolveCallerTier';

/** ISR/prerender에서 `getCurrentUser()`가 `cookies()`를 읽을 때 Next가 던지는 실제 메시지. */
const CACHE_SCOPE_ERROR = new Error(
    'Route /[symbol] used `cookies()` inside a function cached with `unstable_cache()`. ' +
        'Accessing Dynamic data sources inside a cache scope is not supported.'
);

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('resolveCallerTier', () => {
    it('정상 해석 시 resolveTierOnly 결과를 그대로 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
        mockResolveTierOnly.mockResolvedValue('pro');

        await expect(resolveCallerTier('scope')).resolves.toBe('pro');
        expect(mockResolveTierOnly).toHaveBeenCalledWith('u1');
    });

    it('비로그인(user null)이면 null id로 해석한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierOnly.mockResolvedValue('free');

        await expect(resolveCallerTier('scope')).resolves.toBe('free');
        expect(mockResolveTierOnly).toHaveBeenCalledWith(null);
    });

    it('해석 실패 시 free로 fail-closed 한다(상위 tier 오인 방지)', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('db down'));

        await expect(resolveCallerTier('scope')).resolves.toBe('free');
    });

    it('진짜 실패는 scope 접두와 함께 로그로 남긴다', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('db down'));

        await resolveCallerTier('getBarsAction');

        expect(console.error).toHaveBeenCalledWith(
            '[getBarsAction] Failed to resolve caller tier:',
            expect.any(Error)
        );
    });

    // 2026-07-26 인시던트 회귀 가드: 이 로그가 9시간에 2,016건 쌓였다.
    // ISR 경로에서는 캐시 스코프 안에서 cookies()를 읽는 게 정상 동작이라
    // 오류로 기록하면 안 된다(free로 떨어지는 것 자체가 정답).
    it('캐시 스코프 제어 흐름 에러는 로그를 남기지 않는다', async () => {
        mockGetCurrentUser.mockRejectedValue(CACHE_SCOPE_ERROR);

        await expect(resolveCallerTier('getBarsAction')).resolves.toBe('free');
        expect(console.error).not.toHaveBeenCalled();
    });

    // 판별을 Next 메시지의 고정 부분("inside a function cached with")으로만 좁힌
    // 이유(감사 F7): 매칭이 헐거우면 무관한 진짜 실패가 우연히 걸려 조용히 삼켜진다.
    // "cache scope"라는 말만 들어간 일반 오류는 반드시 로그로 남아야 한다.
    it('"cache scope" 문구만 든 무관한 오류는 삼키지 않고 로그로 남긴다', async () => {
        mockGetCurrentUser.mockRejectedValue(
            new Error('Redis eviction happened in the cache scope, sorry')
        );

        await expect(resolveCallerTier('scope')).resolves.toBe('free');
        expect(console.error).toHaveBeenCalled();
    });

    it('Error가 아닌 값이 throw돼도 free로 떨어지고 로그를 남긴다', async () => {
        mockGetCurrentUser.mockRejectedValue('그냥 문자열');

        await expect(resolveCallerTier('scope')).resolves.toBe('free');
        expect(console.error).toHaveBeenCalled();
    });
});
