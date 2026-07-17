import type { MockedFunction } from 'vitest';

const { mockFindByUser, mockUpsert, mockDeleteByUserAndSymbol } = vi.hoisted(
    () => ({
        mockFindByUser: vi.fn(),
        mockUpsert: vi.fn(),
        mockDeleteByUserAndSymbol: vi.fn(),
    })
);

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return {
            findByUser: mockFindByUser,
            upsert: mockUpsert,
            deleteByUserAndSymbol: mockDeleteByUserAndSymbol,
        };
    }),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { getPortfolioHoldingsAction } from '@/entities/portfolio/actions/getPortfolioHoldingsAction';
import { savePortfolioHoldingAction } from '@/entities/portfolio/actions/savePortfolioHoldingAction';
import { deletePortfolioHoldingAction } from '@/entities/portfolio/actions/deletePortfolioHoldingAction';
import type { PortfolioHoldingRecord } from '@/shared/db/types';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;

const AUTHED_USER = { id: 'user-1', email: 'test@example.com' } as never;

function makeRecord(
    overrides: Partial<PortfolioHoldingRecord> = {}
): PortfolioHoldingRecord {
    return {
        id: 'holding-1',
        userId: 'user-1',
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        fmpSymbol: 'AAPL',
        quantity: '10',
        averagePrice: '150.5',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        ...overrides,
    };
}

describe('getPortfolioHoldingsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindByUser.mockResolvedValue([]);
    });

    it('비로그인 시 빈 배열을 반환하고 throw/redirect 하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await getPortfolioHoldingsAction();

        expect(result).toEqual([]);
        expect(mockFindByUser).not.toHaveBeenCalled();
    });

    it('로그인 시 조회한 rows를 toView로 매핑하고 symbol 기준 정렬한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockResolvedValue([
            makeRecord({ symbol: 'TSLA', id: 'holding-2' }),
            makeRecord({ symbol: 'AAPL', id: 'holding-1' }),
        ]);

        const result = await getPortfolioHoldingsAction();

        expect(result.map(r => r.symbol)).toEqual(['AAPL', 'TSLA']);
        expect(result[0]).toEqual({
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            fmpSymbol: 'AAPL',
            quantity: '10',
            averagePrice: '150.5',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });
    });

    it('repo 조회가 (재시도 후에도) 계속 실패하면 결과를 삼키지 않고 그대로 throw한다 — React Query가 isError를 세팅하도록', async () => {
        // A plain Error (not a NeonDbError) is not transient, so withRetry
        // rethrows on the first attempt without sleeping/retrying.
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockRejectedValue(new Error('DB connection failed'));

        await expect(getPortfolioHoldingsAction()).rejects.toThrow(
            'DB connection failed'
        );
    });
});

describe('savePortfolioHoldingAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsert.mockResolvedValue(makeRecord());
    });

    it('비로그인 시 unauthenticated 에러를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await savePortfolioHoldingAction({
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(result).toEqual({
            status: 'error',
            code: 'unauthenticated',
            message: '로그인이 필요합니다.',
        });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('유효하지 않은 symbol shape이면 invalid_symbol 에러를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await savePortfolioHoldingAction({
            symbol: '!!!',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.code).toBe('invalid_symbol');
        }
        expect(mockGetAssetInfo).not.toHaveBeenCalled();
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('input이 object가 아니면(hostile client) invalid_symbol 에러를 반환하고 throw하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await savePortfolioHoldingAction(123 as never);

        expect(result).toEqual({
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 입력입니다.',
        });
        expect(mockGetAssetInfo).not.toHaveBeenCalled();
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('input 필드가 문자열이 아니면(hostile client) invalid_symbol 에러를 반환하고 throw하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await savePortfolioHoldingAction({
            symbol: 'AAPL',
            quantity: 10,
            averagePrice: '150.5',
        } as never);

        expect(result).toEqual({
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 입력입니다.',
        });
        expect(mockGetAssetInfo).not.toHaveBeenCalled();
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('getAssetInfo가 null을 반환하면 symbol_not_found 에러를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue(null);

        const result = await savePortfolioHoldingAction({
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(result).toEqual({
            status: 'error',
            code: 'symbol_not_found',
            message: '존재하지 않는 종목입니다.',
        });
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('getAssetInfo가 throw해도 upsert는 companyName/fmpSymbol=null로 진행되어 성공한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockRejectedValue(new Error('FMP unavailable'));
        mockUpsert.mockResolvedValue(
            makeRecord({ companyName: null, fmpSymbol: null })
        );
        const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        const result = await savePortfolioHoldingAction({
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                symbol: 'AAPL',
                companyName: null,
                fmpSymbol: null,
                quantity: '10',
                averagePrice: '150.5',
            })
        );
        expect(result.status).toBe('ok');
        consoleWarnSpy.mockRestore();
    });

    it('정상 입력 시 upsert가 canonical UPPERCASE symbol + name/fmpSymbol로 호출되고 ok를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            fmpSymbol: 'AAPL',
        } as never);

        const result = await savePortfolioHoldingAction({
            symbol: 'aapl',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                fmpSymbol: 'AAPL',
                quantity: '10',
                averagePrice: '150.5',
            })
        );
        expect(result.status).toBe('ok');
        if (result.status === 'ok') {
            expect(result.holding.symbol).toBe('AAPL');
        }
    });

    it('upsert 실패 시 storage_unavailable 에러를 반환하고 console.error로 로그를 남긴다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            fmpSymbol: 'AAPL',
        } as never);
        mockUpsert.mockRejectedValue(new Error('DB write failed'));
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = await savePortfolioHoldingAction({
            symbol: 'AAPL',
            quantity: '10',
            averagePrice: '150.5',
        });

        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.code).toBe('storage_unavailable');
        }
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});

describe('deletePortfolioHoldingAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteByUserAndSymbol.mockResolvedValue(true);
    });

    it('비로그인 시 unauthenticated 에러를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);

        const result = await deletePortfolioHoldingAction('AAPL');

        expect(result).toEqual({
            status: 'error',
            code: 'unauthenticated',
            message: '로그인이 필요합니다.',
        });
        expect(mockDeleteByUserAndSymbol).not.toHaveBeenCalled();
    });

    it('유효하지 않은 symbol shape이면 invalid_symbol 에러를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await deletePortfolioHoldingAction('!!!');

        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.code).toBe('invalid_symbol');
        }
        expect(mockDeleteByUserAndSymbol).not.toHaveBeenCalled();
    });

    it('symbol이 문자열이 아니면(hostile client) invalid_symbol 에러를 반환하고 throw하지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await deletePortfolioHoldingAction(123 as never);

        expect(result).toEqual({
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 종목 코드입니다.',
        });
        expect(mockDeleteByUserAndSymbol).not.toHaveBeenCalled();
    });

    it('로그인 상태에서 삭제에 성공하면 status: ok를 반환한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);

        const result = await deletePortfolioHoldingAction('aapl');

        expect(mockDeleteByUserAndSymbol).toHaveBeenCalledWith(
            'user-1',
            'AAPL'
        );
        expect(result).toEqual({ status: 'ok' });
    });

    it('삭제 실패 시 storage_unavailable 에러를 반환하고 console.error로 로그를 남긴다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockDeleteByUserAndSymbol.mockRejectedValue(
            new Error('DB delete failed')
        );
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = await deletePortfolioHoldingAction('AAPL');

        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.code).toBe('storage_unavailable');
        }
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
