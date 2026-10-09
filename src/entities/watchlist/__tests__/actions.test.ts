import type { MockedFunction } from 'vitest';

const { mockFindByUser, mockCountByUser, mockAdd, mockRemove, mockMerge } =
    vi.hoisted(() => ({
        mockFindByUser: vi.fn(),
        mockCountByUser: vi.fn(),
        mockAdd: vi.fn(),
        mockRemove: vi.fn(),
        mockMerge: vi.fn(),
    }));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn().mockImplementation(function () {
        return {
            findByUser: mockFindByUser,
            countByUser: mockCountByUser,
            add: mockAdd,
            remove: mockRemove,
            mergeSymbols: mockMerge,
        };
    }),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { getWatchlistAction } from '@/entities/watchlist/actions/getWatchlistAction';
import { addWatchlistItemAction } from '@/entities/watchlist/actions/addWatchlistItemAction';
import { removeWatchlistItemAction } from '@/entities/watchlist/actions/removeWatchlistItemAction';
import { mergeWatchlistAction } from '@/entities/watchlist/actions/mergeWatchlistAction';
import {
    WATCHLIST_MAX_LOCAL,
    WATCHLIST_LABEL_MAX_LENGTH,
    WATCHLIST_MAX_MEMBER,
} from '@/shared/config/watchlist';
import type { WatchlistItemRecord } from '@/shared/db/types';

const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;
const AUTHED_USER = { id: 'user-1', email: 'test@example.com' } as never;

function record(symbol: string, createdAt: string): WatchlistItemRecord {
    return {
        id: `row-${symbol}`,
        userId: 'user-1',
        symbol,
        companyName: null,
        createdAt: new Date(createdAt),
    };
}

describe('getWatchlistAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인이면 빈 배열, 저장소를 부르지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        await expect(getWatchlistAction()).resolves.toEqual([]);
        expect(mockFindByUser).not.toHaveBeenCalled();
    });

    it('최근 담은 순(addedAt 내림차순)으로 뷰를 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockFindByUser.mockResolvedValue([
            record('AAPL', '2026-10-01T00:00:00.000Z'),
            record('MSFT', '2026-10-05T00:00:00.000Z'),
        ]);
        const result = await getWatchlistAction();
        expect(result.map(r => r.symbol)).toEqual(['MSFT', 'AAPL']);
        expect(mockFindByUser).toHaveBeenCalledWith('user-1');
    });
});

describe('addWatchlistItemAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCountByUser.mockResolvedValue(0);
    });

    it('비로그인 → unauthenticated 결과(던지지 않음)', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        const result = await addWatchlistItemAction({
            symbol: 'AAPL',
            label: '애플',
        });
        expect(result).toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('문자열이 아닌 입력은 invalid_symbol', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        const result = await addWatchlistItemAction({
            symbol: 42,
            label: 'x',
        } as never);
        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_symbol',
        });
    });

    it('상한이면 limit_reached, 저장소를 부르지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockCountByUser.mockResolvedValue(WATCHLIST_MAX_MEMBER);
        const result = await addWatchlistItemAction({
            symbol: 'AAPL',
            label: '애플',
        });
        expect(result).toMatchObject({
            status: 'error',
            code: 'limit_reached',
        });
        expect((result as { message: string }).message).toContain(
            String(WATCHLIST_MAX_MEMBER)
        );
        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('getAssetInfo가 null이면 symbol_not_found', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue(null);
        const result = await addWatchlistItemAction({
            symbol: 'zzzz',
            label: 'zzzz',
        });
        expect(result).toMatchObject({
            status: 'error',
            code: 'symbol_not_found',
        });
        expect(mockAdd).not.toHaveBeenCalled();
    });

    it('성공 시 getAssetInfo의 이름을 companyName으로 저장하고 뷰를 돌려준다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        } as never);
        mockAdd.mockResolvedValue({
            ...record('AAPL', '2026-10-09T00:00:00.000Z'),
            companyName: 'Apple Inc.',
        });
        const result = await addWatchlistItemAction({
            symbol: ' aapl ',
            label: '애플',
        });
        expect(mockAdd).toHaveBeenCalledWith({
            userId: 'user-1',
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
        });
        expect(result).toEqual({
            status: 'ok',
            item: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                addedAt: '2026-10-09T00:00:00.000Z',
            },
        });
    });

    it('getAssetInfo가 던지면(FMP 장애) 호출부 라벨로 저장을 진행한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockRejectedValue(new Error('fmp down'));
        mockAdd.mockResolvedValue({
            ...record('TSLA', '2026-10-09T00:00:00.000Z'),
            companyName: '테슬라',
        });
        const result = await addWatchlistItemAction({
            symbol: 'TSLA',
            label: '테슬라',
        });
        expect(mockAdd).toHaveBeenCalledWith({
            userId: 'user-1',
            symbol: 'TSLA',
            companyName: '테슬라',
        });
        expect(result.status).toBe('ok');
    });

    it('클라이언트 라벨이 150자면 100자로 잘라 저장한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockRejectedValue(new Error('fmp down'));
        mockAdd.mockResolvedValue(record('TSLA', '2026-10-09T00:00:00.000Z'));
        await addWatchlistItemAction({
            symbol: 'TSLA',
            label: 'x'.repeat(150),
        });
        expect(mockAdd).toHaveBeenCalledWith({
            userId: 'user-1',
            symbol: 'TSLA',
            companyName: 'x'.repeat(WATCHLIST_LABEL_MAX_LENGTH),
        });
    });

    it('라벨이 심볼과 같으면 companyName은 null', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockRejectedValue(new Error('fmp down'));
        mockAdd.mockResolvedValue(record('TSLA', '2026-10-09T00:00:00.000Z'));
        await addWatchlistItemAction({ symbol: 'TSLA', label: 'tsla' });
        expect(mockAdd).toHaveBeenCalledWith(
            expect.objectContaining({ companyName: null })
        );
    });

    it('저장소가 던지면 storage_unavailable', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockGetAssetInfo.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
        } as never);
        mockAdd.mockRejectedValue(new Error('db'));
        const result = await addWatchlistItemAction({
            symbol: 'AAPL',
            label: '애플',
        });
        expect(result).toMatchObject({
            status: 'error',
            code: 'storage_unavailable',
        });
    });
});

describe('removeWatchlistItemAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인 → unauthenticated', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        await expect(removeWatchlistItemAction('AAPL')).resolves.toMatchObject({
            status: 'error',
            code: 'unauthenticated',
        });
    });

    it('DB 키 안전 형상(SYMBOL_EDGE_RE)만 보고 삭제한다 — 저장 당시보다 엄격해지지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockRemove.mockResolvedValue(true);
        await expect(removeWatchlistItemAction('hvo.l')).resolves.toEqual({
            status: 'ok',
        });
        expect(mockRemove).toHaveBeenCalledWith('user-1', 'HVO.L');
    });

    it('형상이 깨진 심볼은 invalid_symbol', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        await expect(removeWatchlistItemAction('AA PL')).resolves.toMatchObject(
            { code: 'invalid_symbol' }
        );
        expect(mockRemove).not.toHaveBeenCalled();
    });
});

describe('mergeWatchlistAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인 → unauthenticated', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        await expect(
            mergeWatchlistAction([{ symbol: 'AAPL', label: '애플' }])
        ).resolves.toMatchObject({
            code: 'unauthenticated',
        });
    });

    it('형상이 깨진 항목은 버리고, 라벨을 companyName으로 넘기며, 회원 상한을 전달한다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockMerge.mockResolvedValue({ added: 1, skipped: 0 });
        const result = await mergeWatchlistAction([
            { symbol: 'aapl', label: '애플' },
            { symbol: 'AA PL', label: 'bad' },
            { symbol: 'MSFT', label: 'msft' },
        ]);
        expect(mockMerge).toHaveBeenCalledWith(
            'user-1',
            [
                { symbol: 'AAPL', companyName: '애플' },
                { symbol: 'MSFT', companyName: null },
            ],
            WATCHLIST_MAX_MEMBER
        );
        expect(result).toEqual({ status: 'ok', added: 1, skipped: 0 });
    });

    it('150자 라벨은 100자로 잘라 companyName으로 넘긴다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockMerge.mockResolvedValue({ added: 1, skipped: 0 });
        await mergeWatchlistAction([
            { symbol: 'AAPL', label: 'y'.repeat(150) },
        ]);
        expect(mockMerge).toHaveBeenCalledWith(
            'user-1',
            [
                {
                    symbol: 'AAPL',
                    companyName: 'y'.repeat(WATCHLIST_LABEL_MAX_LENGTH),
                },
            ],
            WATCHLIST_MAX_MEMBER
        );
    });

    it('로컬 상한보다 많이 오면 앞에서 WATCHLIST_MAX_LOCAL개만 받는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockMerge.mockResolvedValue({ added: 0, skipped: 0 });
        const entries = Array.from(
            { length: WATCHLIST_MAX_LOCAL + 5 },
            (_, i) => ({
                symbol: `S${i}`,
                label: `S${i}`,
            })
        );
        await mergeWatchlistAction(entries);
        const [, candidates] = mockMerge.mock.calls.find(
            call => call[0] === 'user-1'
        )!;
        expect(candidates).toHaveLength(WATCHLIST_MAX_LOCAL);
    });

    it('배열이 아니면 invalid_symbol, 저장소를 부르지 않는다', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        await expect(
            mergeWatchlistAction('AAPL' as never)
        ).resolves.toMatchObject({ code: 'invalid_symbol' });
        expect(mockMerge).not.toHaveBeenCalled();
    });

    it('저장소가 던지면 storage_unavailable', async () => {
        mockGetCurrentUser.mockResolvedValue(AUTHED_USER);
        mockMerge.mockRejectedValue(new Error('db'));
        await expect(
            mergeWatchlistAction([{ symbol: 'AAPL', label: '애플' }])
        ).resolves.toMatchObject({
            code: 'storage_unavailable',
        });
    });
});
