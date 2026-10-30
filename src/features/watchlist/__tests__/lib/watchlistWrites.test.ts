import {
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    type WatchlistWriteContext,
} from '@/features/watchlist/lib/watchlistWrites';

const ENTRY = { symbol: 'AAPL', label: '애플' };
const ITEM = {
    symbol: 'AAPL',
    companyName: '애플',
    addedAt: '2026-10-01T00:00:00.000Z',
};

function makeContext(
    overrides: Partial<WatchlistWriteContext> = {}
): WatchlistWriteContext {
    return {
        isMember: false,
        has: () => false,
        isAtLimit: false,
        failedMessage: '실패 문구',
        limitMessage: '상한 문구',
        showMessage: vi.fn(),
        track: vi.fn(),
        addLocal: vi.fn(() => true),
        removeLocal: vi.fn(() => true),
        addServer: vi.fn(async () => ({
            status: 'ok' as const,
            item: ITEM,
            created: true,
        })),
        removeServer: vi.fn(async () => ({ status: 'ok' as const })),
        ...overrides,
    };
}

describe('addToWatchlist', () => {
    it('이미 담겨 있으면 쓰지 않고 added', async () => {
        const ctx = makeContext({ has: () => true });
        expect(await addToWatchlist(ctx, ENTRY, 'search')).toBe('added');
        expect(ctx.addLocal).not.toHaveBeenCalled();
        expect(ctx.track).not.toHaveBeenCalled();
    });

    it('상한이면 상한 문구를 띄우고 at_limit', async () => {
        const ctx = makeContext({ isAtLimit: true });
        expect(await addToWatchlist(ctx, ENTRY, 'search')).toBe('at_limit');
        expect(ctx.showMessage).toHaveBeenCalledWith('상한 문구');
        expect(ctx.addLocal).not.toHaveBeenCalled();
    });

    it('비회원: 로컬에 쓰고 source로 이벤트를 보낸다', async () => {
        const ctx = makeContext();
        expect(await addToWatchlist(ctx, ENTRY, 'search')).toBe('added');
        expect(ctx.addLocal).toHaveBeenCalledWith(ENTRY);
        expect(ctx.addServer).not.toHaveBeenCalled();
        expect(ctx.track).toHaveBeenCalledWith('search');
    });

    it('비회원: 로컬 쓰기가 실패하면 실패 문구, failed, 이벤트 없음', async () => {
        const ctx = makeContext({ addLocal: vi.fn(() => false) });
        expect(await addToWatchlist(ctx, ENTRY, 'search')).toBe('failed');
        expect(ctx.showMessage).toHaveBeenCalledWith('실패 문구');
        expect(ctx.track).not.toHaveBeenCalled();
    });

    it('회원: 서버에 새로 담기면(created) 이벤트를 보낸다', async () => {
        const ctx = makeContext({ isMember: true });
        expect(await addToWatchlist(ctx, ENTRY, 'nudge')).toBe('added');
        expect(ctx.addServer).toHaveBeenCalledWith(ENTRY);
        expect(ctx.addLocal).not.toHaveBeenCalled();
        expect(ctx.track).toHaveBeenCalledWith('nudge');
    });

    it('회원: 멱등 성공(created=false)이면 이벤트를 보내지 않는다', async () => {
        const ctx = makeContext({
            isMember: true,
            addServer: vi.fn(async () => ({
                status: 'ok' as const,
                item: ITEM,
                created: false,
            })),
        });
        expect(await addToWatchlist(ctx, ENTRY, 'nudge')).toBe('added');
        expect(ctx.track).not.toHaveBeenCalled();
    });

    it('회원: error 결과면 서버 문구를 띄우고 failed', async () => {
        const ctx = makeContext({
            isMember: true,
            addServer: vi.fn(async () => ({
                status: 'error' as const,
                code: 'limit_reached' as const,
                message: '서버 문구',
            })),
        });
        expect(await addToWatchlist(ctx, ENTRY, 'nudge')).toBe('failed');
        expect(ctx.showMessage).toHaveBeenCalledWith('서버 문구');
    });

    it('회원: 액션이 던지면 실패 문구를 띄우고 failed', async () => {
        const ctx = makeContext({
            isMember: true,
            addServer: vi.fn(async () => {
                throw new Error('network');
            }),
        });
        expect(await addToWatchlist(ctx, ENTRY, 'nudge')).toBe('failed');
        expect(ctx.showMessage).toHaveBeenCalledWith('실패 문구');
    });
});

describe('removeFromWatchlist', () => {
    it('비회원: 로컬에서 빼면 true', async () => {
        const ctx = makeContext();
        expect(await removeFromWatchlist(ctx, 'AAPL')).toBe(true);
        expect(ctx.removeLocal).toHaveBeenCalledWith('AAPL');
        expect(ctx.showMessage).not.toHaveBeenCalled();
    });

    it('비회원: 로컬 쓰기가 실패하면 실패 문구, false', async () => {
        const ctx = makeContext({ removeLocal: vi.fn(() => false) });
        expect(await removeFromWatchlist(ctx, 'AAPL')).toBe(false);
        expect(ctx.showMessage).toHaveBeenCalledWith('실패 문구');
    });

    it('회원: 서버에서 빼면 true', async () => {
        const ctx = makeContext({ isMember: true });
        expect(await removeFromWatchlist(ctx, 'AAPL')).toBe(true);
        expect(ctx.removeServer).toHaveBeenCalledWith('AAPL');
        expect(ctx.removeLocal).not.toHaveBeenCalled();
    });

    it('회원: error 결과면 서버 문구, false', async () => {
        const ctx = makeContext({
            isMember: true,
            removeServer: vi.fn(async () => ({
                status: 'error' as const,
                code: 'storage_unavailable' as const,
                message: '서버 문구',
            })),
        });
        expect(await removeFromWatchlist(ctx, 'AAPL')).toBe(false);
        expect(ctx.showMessage).toHaveBeenCalledWith('서버 문구');
    });

    it('회원: 액션이 던지면 실패 문구, false', async () => {
        const ctx = makeContext({
            isMember: true,
            removeServer: vi.fn(async () => {
                throw new Error('network');
            }),
        });
        expect(await removeFromWatchlist(ctx, 'AAPL')).toBe(false);
        expect(ctx.showMessage).toHaveBeenCalledWith('실패 문구');
    });
});

describe('toggleWatchlist', () => {
    it('담겨 있으면 빼고 removed, 이벤트 없음', async () => {
        const ctx = makeContext({ has: () => true });
        expect(await toggleWatchlist(ctx, ENTRY, 'search')).toBe('removed');
        expect(ctx.removeLocal).toHaveBeenCalledWith('AAPL');
        expect(ctx.track).not.toHaveBeenCalled();
    });

    it('빼기에 실패하면 failed', async () => {
        const ctx = makeContext({
            has: () => true,
            removeLocal: vi.fn(() => false),
        });
        expect(await toggleWatchlist(ctx, ENTRY, 'search')).toBe('failed');
    });

    it('없으면 담고 added', async () => {
        const ctx = makeContext();
        expect(await toggleWatchlist(ctx, ENTRY, 'search')).toBe('added');
        expect(ctx.addLocal).toHaveBeenCalledWith(ENTRY);
    });
});
