import {
    addLocalWatchlistEntry,
    clearLocalWatchlist,
    parseLocalWatchlist,
    readLocalWatchlist,
    removeLocalWatchlistEntry,
    toWatchlistViews,
} from '@/features/watchlist/lib/localWatchlist';
import { WATCHLIST_MAX_LOCAL } from '@/shared/config/watchlist';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';

function memoryStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
        dump: () => map.get(LOCAL_STORAGE_WATCHLIST_KEY) ?? null,
    };
}

const T0 = 1_760_000_000_000;

describe('parseLocalWatchlist', () => {
    it.each([null, '', 'not json', '{"a":1}', '42'])('%j → []', raw => {
        expect(parseLocalWatchlist(raw)).toEqual([]);
    });

    it('깨진 항목은 버리고 정상 항목만 남긴다', () => {
        const raw = JSON.stringify([
            { symbol: 'AAPL', label: '애플', addedAt: T0 },
            { symbol: '', label: 'x', addedAt: T0 },
            { label: '심볼 없음', addedAt: T0 },
            { symbol: 'MSFT', label: 7, addedAt: 'yesterday' },
            'AAPL',
            null,
        ]);
        expect(parseLocalWatchlist(raw)).toEqual([
            { symbol: 'AAPL', label: '애플', addedAt: T0 },
            // 라벨·시각이 깨진 항목은 심볼로 라벨을, 0으로 시각을 채워 살린다.
            { symbol: 'MSFT', label: 'MSFT', addedAt: 0 },
        ]);
    });

    it('Date 범위를 넘는 addedAt은 0으로 바꿔 toISOString이 던지지 않게 한다', () => {
        const raw = JSON.stringify([
            { symbol: 'AAPL', label: '애플', addedAt: 1e20 },
            { symbol: 'MSFT', label: 'MS', addedAt: -1e20 },
        ]);
        const parsed = parseLocalWatchlist(raw);
        expect(parsed.map(e => e.addedAt)).toEqual([0, 0]);
        expect(() => toWatchlistViews(parsed)).not.toThrow();
    });

    it('최근 담은 순(addedAt 내림차순)으로 정렬하고 같은 심볼은 최신 것만 남긴다', () => {
        const raw = JSON.stringify([
            { symbol: 'AAPL', label: '애플', addedAt: T0 },
            { symbol: 'MSFT', label: 'MS', addedAt: T0 + 2 },
            { symbol: 'AAPL', label: 'Apple', addedAt: T0 + 1 },
        ]);
        expect(parseLocalWatchlist(raw)).toEqual([
            { symbol: 'MSFT', label: 'MS', addedAt: T0 + 2 },
            { symbol: 'AAPL', label: 'Apple', addedAt: T0 + 1 },
        ]);
    });

    it(`상한 ${WATCHLIST_MAX_LOCAL}개를 넘는 꼬리(오래된 것)는 버린다`, () => {
        const raw = JSON.stringify(
            Array.from({ length: WATCHLIST_MAX_LOCAL + 3 }, (_, i) => ({
                symbol: `S${i}`,
                label: `S${i}`,
                addedAt: T0 + i,
            }))
        );
        const parsed = parseLocalWatchlist(raw);
        expect(parsed).toHaveLength(WATCHLIST_MAX_LOCAL);
        expect(parsed[0]?.symbol).toBe(`S${WATCHLIST_MAX_LOCAL + 2}`);
    });
});

describe('addLocalWatchlistEntry', () => {
    it('정규화한 심볼을 맨 앞에 넣고 저장한다', () => {
        const storage = memoryStorage();
        const { entries, added } = addLocalWatchlistEntry(
            { symbol: ' aapl ', label: '애플' },
            T0,
            storage
        );
        expect(added).toBe(true);
        expect(entries).toEqual([
            { symbol: 'AAPL', label: '애플', addedAt: T0 },
        ]);
        expect(JSON.parse(storage.dump()!)).toEqual(entries);
    });

    it('이미 있으면 added=false, 목록은 그대로다', () => {
        const storage = memoryStorage({
            [LOCAL_STORAGE_WATCHLIST_KEY]: JSON.stringify([
                { symbol: 'AAPL', label: '애플', addedAt: T0 },
            ]),
        });
        const { added, entries } = addLocalWatchlistEntry(
            { symbol: 'AAPL', label: 'Apple' },
            T0 + 5,
            storage
        );
        expect(added).toBe(false);
        expect(entries).toEqual([
            { symbol: 'AAPL', label: '애플', addedAt: T0 },
        ]);
    });

    it('상한이면 added=false, 저장하지 않는다', () => {
        const full = Array.from({ length: WATCHLIST_MAX_LOCAL }, (_, i) => ({
            symbol: `S${i}`,
            label: `S${i}`,
            addedAt: T0 + i,
        }));
        const storage = memoryStorage({
            [LOCAL_STORAGE_WATCHLIST_KEY]: JSON.stringify(full),
        });
        const { added, entries } = addLocalWatchlistEntry(
            { symbol: 'NEW', label: 'New' },
            T0 + 99,
            storage
        );
        expect(added).toBe(false);
        expect(entries).toHaveLength(WATCHLIST_MAX_LOCAL);
        expect(entries.some(e => e.symbol === 'NEW')).toBe(false);
    });

    it('setItem이 던지면 added=false, 목록은 그대로', () => {
        const storage = memoryStorage();
        storage.setItem = () => {
            throw new Error('blocked');
        };
        expect(
            addLocalWatchlistEntry(
                { symbol: 'AAPL', label: '애플' },
                T0,
                storage
            )
        ).toEqual({ entries: [], added: false });
    });

    it('빈 라벨은 심볼로 대체한다', () => {
        const { entries } = addLocalWatchlistEntry(
            { symbol: 'TSLA', label: '   ' },
            T0,
            memoryStorage()
        );
        expect(entries[0]?.label).toBe('TSLA');
    });

    it('storage가 null(SSR)이면 저장 없이 빈 결과', () => {
        expect(
            addLocalWatchlistEntry({ symbol: 'AAPL', label: 'a' }, T0, null)
        ).toEqual({ entries: [], added: false });
    });
});

describe('removeLocalWatchlistEntry / clearLocalWatchlist', () => {
    it('remove는 심볼을 빼고 저장한다(대소문자 무관)', () => {
        const storage = memoryStorage({
            [LOCAL_STORAGE_WATCHLIST_KEY]: JSON.stringify([
                { symbol: 'AAPL', label: '애플', addedAt: T0 },
                { symbol: 'MSFT', label: 'MS', addedAt: T0 + 1 },
            ]),
        });
        expect(removeLocalWatchlistEntry('aapl', storage)).toEqual({
            entries: [{ symbol: 'MSFT', label: 'MS', addedAt: T0 + 1 }],
            removed: true,
        });
        expect(readLocalWatchlist(storage)).toHaveLength(1);
    });

    it('setItem이 던지면 removed=false, 목록은 그대로', () => {
        const storage = memoryStorage({
            [LOCAL_STORAGE_WATCHLIST_KEY]: JSON.stringify([
                { symbol: 'AAPL', label: '애플', addedAt: T0 },
            ]),
        });
        storage.setItem = () => {
            throw new Error('blocked');
        };
        const result = removeLocalWatchlistEntry('AAPL', storage);
        expect(result.removed).toBe(false);
        expect(result.entries).toHaveLength(1);
    });

    it('clear는 키를 지운다', () => {
        const storage = memoryStorage({ [LOCAL_STORAGE_WATCHLIST_KEY]: '[]' });
        clearLocalWatchlist(storage);
        expect(storage.dump()).toBeNull();
    });
});

describe('toWatchlistViews', () => {
    it('라벨이 심볼과 같으면 companyName=null, addedAt은 ISO', () => {
        expect(
            toWatchlistViews([
                { symbol: 'AAPL', label: '애플', addedAt: T0 },
                { symbol: 'MSFT', label: 'MSFT', addedAt: T0 },
            ])
        ).toEqual([
            {
                symbol: 'AAPL',
                companyName: '애플',
                addedAt: new Date(T0).toISOString(),
            },
            {
                symbol: 'MSFT',
                companyName: null,
                addedAt: new Date(T0).toISOString(),
            },
        ]);
    });
});
