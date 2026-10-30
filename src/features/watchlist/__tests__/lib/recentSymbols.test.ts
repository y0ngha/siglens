import {
    parseRecentSymbols,
    readRecentSymbols,
    recordRecentSymbol,
} from '@/features/watchlist/lib/recentSymbols';
import type { StorageLike } from '@/features/watchlist/lib/browserStorage';
import { RECENT_SYMBOLS_MAX } from '@/shared/config/watchlist';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

function memoryStorage(initial?: string): StorageLike & {
    data: Map<string, string>;
} {
    const data = new Map<string, string>();
    if (initial !== undefined)
        data.set(LOCAL_STORAGE_RECENT_SYMBOLS_KEY, initial);
    return {
        data,
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: key => void data.delete(key),
    };
}

describe('parseRecentSymbols', () => {
    it('깨진 값이면 빈 목록이다', () => {
        expect(parseRecentSymbols(null)).toEqual([]);
        expect(parseRecentSymbols('not json')).toEqual([]);
        expect(parseRecentSymbols('{"a":1}')).toEqual([]);
    });

    it('살릴 수 있는 항목만 최근 순으로 남기고 심볼을 정규화한다', () => {
        const raw = JSON.stringify([
            { symbol: 'aapl', label: '', viewedAt: 1 },
            { symbol: 'NVDA', label: '엔비디아', viewedAt: 3 },
            { symbol: 42 },
            { symbol: 'AAPL', label: '애플', viewedAt: 0 },
        ]);
        expect(parseRecentSymbols(raw)).toEqual([
            { symbol: 'NVDA', label: '엔비디아', viewedAt: 3 },
            { symbol: 'AAPL', label: 'AAPL', viewedAt: 1 },
        ]);
    });
});

describe('recordRecentSymbol', () => {
    it('새 종목을 맨 앞에 기록한다', () => {
        const storage = memoryStorage();
        expect(
            recordRecentSymbol({ symbol: 'aapl', label: '애플' }, 10, storage)
        ).toBe(true);
        expect(readRecentSymbols(storage)).toEqual([
            { symbol: 'AAPL', label: '애플', viewedAt: 10 },
        ]);
    });

    it('이미 본 종목은 중복 없이 맨 앞으로 옮긴다', () => {
        const storage = memoryStorage();
        recordRecentSymbol({ symbol: 'AAPL', label: '애플' }, 1, storage);
        recordRecentSymbol({ symbol: 'NVDA', label: '엔비디아' }, 2, storage);
        recordRecentSymbol({ symbol: 'AAPL', label: '애플' }, 3, storage);
        expect(readRecentSymbols(storage).map(e => e.symbol)).toEqual([
            'AAPL',
            'NVDA',
        ]);
    });

    it(`최대 ${RECENT_SYMBOLS_MAX}개만 남기고 오래된 것을 버린다`, () => {
        const storage = memoryStorage();
        for (let i = 0; i <= RECENT_SYMBOLS_MAX; i++) {
            recordRecentSymbol({ symbol: `S${i}`, label: '' }, i, storage);
        }
        const symbols = readRecentSymbols(storage).map(e => e.symbol);
        expect(symbols).toHaveLength(RECENT_SYMBOLS_MAX);
        expect(symbols[0]).toBe(`S${RECENT_SYMBOLS_MAX}`);
        expect(symbols).not.toContain('S0');
    });

    it('저장소가 없거나 쓰기에 실패하면 false', () => {
        expect(recordRecentSymbol({ symbol: 'AAPL', label: '' }, 1, null)).toBe(
            false
        );
        const broken: StorageLike = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota');
            },
            removeItem: () => {},
        };
        expect(
            recordRecentSymbol({ symbol: 'AAPL', label: '' }, 1, broken)
        ).toBe(false);
    });

    it('빈 심볼은 기록하지 않는다', () => {
        const storage = memoryStorage();
        expect(
            recordRecentSymbol({ symbol: '  ', label: '' }, 1, storage)
        ).toBe(false);
        expect(storage.data.size).toBe(0);
    });
});
