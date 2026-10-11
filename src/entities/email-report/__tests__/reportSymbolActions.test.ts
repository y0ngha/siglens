import type { MockedFunction } from 'vitest';

const { mockExclude, mockInclude } = vi.hoisted(() => ({
    mockExclude: vi.fn(),
    mockInclude: vi.fn(),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/shared/lib/logActionError', () => ({ logActionError: vi.fn() }));
vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportExclusionRepository: vi
        .fn()
        .mockImplementation(function () {
            return { excludeSymbol: mockExclude, includeSymbol: mockInclude };
        }),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { excludeReportSymbolAction } from '@/entities/email-report/actions/excludeReportSymbolAction';
import { includeReportSymbolAction } from '@/entities/email-report/actions/includeReportSymbolAction';
import { EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS } from '@/entities/email-report/lib/emailReportConstants';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const AUTHED_USER = { id: 'user-1', email: 'test@example.com' } as never;

describe('excludeReportSymbolAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExclude.mockResolvedValue('excluded');
    });

    it('비로그인이면 unauthenticated 오류이고 저장하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await excludeReportSymbolAction({ symbol: 'AAPL' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockExclude).not.toHaveBeenCalled();
    });

    it.each([
        ['형상이 틀린 심볼', { symbol: 'A B;' }],
        ['null 입력', null],
        ['symbol이 문자열이 아님', { symbol: 1 }],
    ])('%s은 invalid_symbol이고 저장하지 않는다', async (_, input) => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await excludeReportSymbolAction(input as never);

        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_symbol',
        });
        expect(mockExclude).not.toHaveBeenCalled();
    });

    it('상한이면 limit_reached 오류와 상한이 든 문구를 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockExclude.mockResolvedValue('limit_reached');

        const result = await excludeReportSymbolAction({ symbol: 'AAPL' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'limit_reached',
        });
        expect(result.status === 'error' ? result.message : '').toContain(
            String(EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS)
        );
    });

    it('정규화한 심볼을 회원 id·상한과 함께 저장하고 ok를 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await excludeReportSymbolAction({ symbol: ' aapl ' });

        expect(result).toEqual({ status: 'ok' });
        expect(mockExclude).toHaveBeenCalledWith(
            'user-1',
            'AAPL',
            EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS
        );
    });

    it('저장소 예외는 던지지 않고 storage_unavailable로 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockExclude.mockRejectedValue(new Error('db down'));

        const result = await excludeReportSymbolAction({ symbol: 'AAPL' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'storage_unavailable',
        });
    });
});

describe('includeReportSymbolAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInclude.mockResolvedValue(true);
    });

    it('비로그인이면 unauthenticated 오류이고 지우지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await includeReportSymbolAction({ symbol: 'AAPL' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockInclude).not.toHaveBeenCalled();
    });

    it('형상이 틀린 심볼은 invalid_symbol이고 지우지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await includeReportSymbolAction({ symbol: 'A B;' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_symbol',
        });
        expect(mockInclude).not.toHaveBeenCalled();
    });

    it('정규화한 심볼의 행을 지우고 ok를 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await includeReportSymbolAction({ symbol: 'tsla' });

        expect(result).toEqual({ status: 'ok' });
        expect(mockInclude).toHaveBeenCalledWith('user-1', 'TSLA');
    });

    it('뺀 적 없는 심볼(false)도 ok다 — 멱등', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockInclude.mockResolvedValue(false);

        await expect(
            includeReportSymbolAction({ symbol: 'TSLA' })
        ).resolves.toEqual({ status: 'ok' });
    });

    it('저장소 예외는 던지지 않고 storage_unavailable로 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockInclude.mockRejectedValue(new Error('db down'));

        const result = await includeReportSymbolAction({ symbol: 'TSLA' });

        expect(result).toMatchObject({
            status: 'error',
            code: 'storage_unavailable',
        });
    });
});
