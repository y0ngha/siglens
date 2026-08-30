import {
    LEGACY_RECENT_SEARCHES_STORAGE_KEY,
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    MAX_RECENT_SEARCHES,
    RECENT_SEARCHES_STORAGE_KEY,
    relabelRecentSearches,
    removeRecentSearch,
} from '../../lib/recentSearches';

function createMemoryStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
            map.set(key, value);
        },
        removeItem: (key: string) => {
            map.delete(key);
        },
        _map: map,
    };
}

/**
 * 저장 단위가 `string`(티커)에서 `{ symbol, label }`로 바뀌었다(2026-08).
 * 기대값이 엔트리 형태인 것은 그 때문이고, **문자열을 저장해 두는 픽스처는
 * 일부러 남겨 둔다** — 기존 사용자의 LocalStorage에 그 형태가 남아 있으므로
 * 파서가 승격시켜야 최근 검색이 사라지지 않는다.
 */
describe('recentSearches', () => {
    describe('getRecentSearches', () => {
        it('storage가 비어 있으면 빈 배열을 반환한다', () => {
            const storage = createMemoryStorage();
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('storage가 null이면 빈 배열을 반환한다', () => {
            expect(getRecentSearches(null)).toEqual([]);
        });

        it('잘못된 JSON이 저장돼 있으면 빈 배열을 반환한다', () => {
            const storage = createMemoryStorage();
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, '{not json');
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('배열이 아닌 값이 저장돼 있으면 빈 배열을 반환한다', () => {
            const storage = createMemoryStorage();
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, '"AAPL"');
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('문자열이 아닌 항목은 필터링한다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['AAPL', 1, null, '', 'TSLA'])
            );
            expect(getRecentSearches(storage)).toEqual([
                { symbol: 'AAPL', label: 'AAPL' },
                { symbol: 'TSLA', label: 'TSLA' },
            ]);
        });

        it('최대 개수까지만 반환한다', () => {
            const storage = createMemoryStorage();
            const tickers = Array.from({ length: 20 }, (_, i) => `T${i}`);
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(tickers)
            );
            expect(getRecentSearches(storage)).toHaveLength(
                MAX_RECENT_SEARCHES
            );
        });
    });

    describe('addRecentSearch', () => {
        it('새 종목을 최상단에 추가한다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch('AAPL', storage);
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('대문자로 정규화하고 trim한다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch('  aapl  ', storage);
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('빈 문자열은 무시한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            const result = addRecentSearch('   ', storage);
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('중복 검색 시 기존 항목을 제거하고 최상단으로 이동한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            addRecentSearch('TSLA', storage);
            addRecentSearch('NVDA', storage);
            const result = addRecentSearch('AAPL', storage);
            expect(result).toEqual([
                { symbol: 'AAPL', label: 'AAPL' },
                { symbol: 'NVDA', label: 'NVDA' },
                { symbol: 'TSLA', label: 'TSLA' },
            ]);
        });

        it('최대 개수를 초과하면 가장 오래된 항목을 제거한다', () => {
            const storage = createMemoryStorage();
            for (let i = 0; i < MAX_RECENT_SEARCHES; i++) {
                addRecentSearch(`T${i}`, storage);
            }
            const result = addRecentSearch('NEW', storage);
            expect(result).toHaveLength(MAX_RECENT_SEARCHES);
            expect(result[0]).toEqual({ symbol: 'NEW', label: 'NEW' });
            expect(result.map(e => e.symbol)).not.toContain('T0');
        });

        it('storage가 null이어도 정규화된 결과를 반환한다', () => {
            const result = addRecentSearch('aapl', null);
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('storage 쓰기 실패 시에도 결과를 반환한다', () => {
            const storage = {
                getItem: () => null,
                setItem: () => {
                    throw new Error('quota exceeded');
                },
                removeItem: () => {},
            };
            expect(() => addRecentSearch('AAPL', storage)).not.toThrow();
        });
    });

    describe('회사명 라벨', () => {
        it('회사명을 함께 저장하고 그대로 돌려준다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch(
                { symbol: '005930.KS', label: '삼성전자' },
                storage
            );
            expect(result).toEqual([
                { symbol: '005930.KS', label: '삼성전자' },
            ]);
            expect(getRecentSearches(storage)).toEqual([
                { symbol: '005930.KS', label: '삼성전자' },
            ]);
        });

        it('회사명 대소문자는 보존하고 심볼만 정규화한다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch(
                { symbol: ' 005930.ks ', label: 'LG화학' },
                storage
            );
            expect(result).toEqual([{ symbol: '005930.KS', label: 'LG화학' }]);
        });

        it('라벨이 공백뿐이면 정규화된 심볼로 대체한다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch(
                { symbol: 'aapl', label: '   ' },
                storage
            );
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('같은 종목을 다시 검색하면 라벨을 최신 값으로 갱신한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch({ symbol: 'AAPL', label: 'AAPL' }, storage);
            const result = addRecentSearch(
                { symbol: 'AAPL', label: '애플' },
                storage
            );
            expect(result).toEqual([{ symbol: 'AAPL', label: '애플' }]);
        });

        it('레거시 string[] 저장값을 심볼=라벨 엔트리로 승격시킨다', () => {
            // 형태를 바꿨다고 기존 사용자의 최근 검색이 사라지면 안 된다.
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['AAPL', 'TSLA'])
            );
            expect(getRecentSearches(storage)).toEqual([
                { symbol: 'AAPL', label: 'AAPL' },
                { symbol: 'TSLA', label: 'TSLA' },
            ]);
        });

        it('레거시와 신규 형태가 섞여 있어도 둘 다 읽는다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([
                    { symbol: '005930.KS', label: '삼성전자' },
                    'AAPL',
                ])
            );
            expect(getRecentSearches(storage)).toEqual([
                { symbol: '005930.KS', label: '삼성전자' },
                { symbol: 'AAPL', label: 'AAPL' },
            ]);
        });

        it('label 필드가 없거나 문자열이 아니면 심볼로 대체한다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([
                    { symbol: 'AAPL' },
                    { symbol: 'TSLA', label: 42 },
                    { symbol: 'NVDA', label: '' },
                    { symbol: 'MSFT', label: '   ' },
                    { symbol: '', label: '빈심볼' },
                ])
            );
            expect(getRecentSearches(storage)).toEqual([
                { symbol: 'AAPL', label: 'AAPL' },
                { symbol: 'TSLA', label: 'TSLA' },
                { symbol: 'NVDA', label: 'NVDA' },
                { symbol: 'MSFT', label: 'MSFT' },
            ]);
        });
    });

    describe('저장 키 버전 분리', () => {
        it('v2 키가 없으면 v1 값을 승격해 읽는다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['AAPL', 'TSLA'])
            );
            expect(getRecentSearches(storage)).toEqual([
                { symbol: 'AAPL', label: 'AAPL' },
                { symbol: 'TSLA', label: 'TSLA' },
            ]);
        });

        it('쓰기는 v2 키에만 한다 — 옛 번들이 읽는 v1을 건드리지 않는다', () => {
            // 배포 후 최대 24시간은 옛 번들이 함께 살아 있고, 그 파서는 객체 항목을
            // 버린 뒤 string[]로 덮어쓴다. v1에 쓰면 그 순간 데이터가 날아간다.
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['OLD'])
            );
            addRecentSearch(
                { symbol: '005930.KS', label: '삼성전자' },
                storage
            );
            expect(storage.getItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY)).toBe(
                JSON.stringify(['OLD'])
            );
            expect(storage.getItem(RECENT_SEARCHES_STORAGE_KEY)).toContain(
                '삼성전자'
            );
        });

        it('v2가 빈 배열이면 v1으로 되돌아가지 않는다', () => {
            // "비어 있음"과 "없음"을 구분하지 않으면 전부 지운 직후 v1이 되살아난다.
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['GHOST'])
            );
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify([]));
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('모두 지우기는 v1까지 지운다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['GHOST'])
            );
            addRecentSearch({ symbol: 'AAPL', label: '애플' }, storage);
            clearRecentSearches(storage);
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('첫 쓰기에서 v1 이력을 v2로 흡수한다', () => {
            // 승격은 읽기에서 일어나고 `addRecentSearch`가 그 결과 위에 쌓으므로,
            // 옛 이력은 버려지지 않고 v2로 옮겨 간다.
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['OLD1', 'OLD2'])
            );
            addRecentSearch({ symbol: 'AAPL', label: '애플' }, storage);
            expect(getRecentSearches(storage).map(e => e.symbol)).toEqual([
                'AAPL',
                'OLD1',
                'OLD2',
            ]);
        });

        it('흡수된 뒤 마지막 항목까지 지우면 빈 상태가 유지된다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                LEGACY_RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify(['OLD'])
            );
            addRecentSearch({ symbol: 'AAPL', label: '애플' }, storage);
            removeRecentSearch('AAPL', storage);
            expect(removeRecentSearch('OLD', storage)).toEqual([]);
            // v2가 `[]`로 남아 있으므로 v1 승격 경로를 다시 타지 않는다.
            expect(getRecentSearches(storage)).toEqual([]);
        });
    });

    describe('removeRecentSearch', () => {
        it('해당 종목을 제거한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            addRecentSearch('TSLA', storage);
            const result = removeRecentSearch('AAPL', storage);
            expect(result).toEqual([{ symbol: 'TSLA', label: 'TSLA' }]);
        });

        it('대소문자/공백 정규화 후 제거한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            const result = removeRecentSearch('  aapl  ', storage);
            expect(result).toEqual([]);
        });

        it('storage 쓰기 실패 시에도 throw하지 않는다', () => {
            const storage = {
                getItem: () => JSON.stringify(['AAPL']),
                setItem: () => {
                    throw new Error('fail');
                },
                removeItem: () => {},
            };
            expect(() => removeRecentSearch('AAPL', storage)).not.toThrow();
        });
    });

    describe('clearRecentSearches', () => {
        it('storage에서 키를 제거한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            clearRecentSearches(storage);
            expect(getRecentSearches(storage)).toEqual([]);
        });

        it('storage가 null이면 아무 작업도 하지 않는다', () => {
            expect(() => clearRecentSearches(null)).not.toThrow();
        });

        it('storage 제거 실패 시에도 throw하지 않는다', () => {
            const storage = {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {
                    throw new Error('fail');
                },
            };
            expect(() => clearRecentSearches(storage)).not.toThrow();
        });
    });

    describe('getDefaultStorage fallback (node env)', () => {
        it('window가 undefined인 환경에서 storage 인자 없이 호출하면 빈 배열 반환', () => {
            // In node test env, window is undefined → getDefaultStorage returns null
            expect(getRecentSearches()).toEqual([]);
        });

        it('window가 undefined인 환경에서 addRecentSearch storage 인자 없이 호출', () => {
            // null storage — 결과는 반환되지만 영속화되지 않음
            const result = addRecentSearch('AAPL');
            expect(result).toEqual([{ symbol: 'AAPL', label: 'AAPL' }]);
        });

        it('window가 undefined인 환경에서 removeRecentSearch storage 인자 없이 호출', () => {
            const result = removeRecentSearch('AAPL');
            expect(result).toEqual([]);
        });

        it('window가 undefined인 환경에서 clearRecentSearches storage 인자 없이 호출', () => {
            expect(() => clearRecentSearches()).not.toThrow();
        });
    });

    describe('relabelRecentSearches', () => {
        it('라벨이 심볼과 같은 항목만 회사명으로 채운다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([
                    { symbol: '005930.KS', label: '005930.KS' },
                    { symbol: 'AAPL', label: '애플' },
                ])
            );

            const result = relabelRecentSearches(
                { '005930.KS': '삼성전자', AAPL: 'Apple Inc.' },
                storage
            );

            expect(result).toEqual([
                { symbol: '005930.KS', label: '삼성전자' },
                // 이미 회사명이 붙은 항목은 덮어쓰지 않는다.
                { symbol: 'AAPL', label: '애플' },
            ]);
            expect(getRecentSearches(storage)).toEqual(result);
        });

        it('순서를 바꾸지 않는다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([
                    { symbol: 'PLTR', label: 'PLTR' },
                    { symbol: 'TSLA', label: 'TSLA' },
                ])
            );

            const result = relabelRecentSearches({ TSLA: '테슬라' }, storage);

            expect(result.map(entry => entry.symbol)).toEqual(['PLTR', 'TSLA']);
        });

        it('채울 라벨이 없으면 저장하지 않는다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([{ symbol: 'LAES', label: 'LAES' }])
            );
            let writes = 0;
            const counted = {
                ...storage,
                setItem: (key: string, value: string) => {
                    writes += 1;
                    storage.setItem(key, value);
                },
            };

            const result = relabelRecentSearches({ NVDA: '엔비디아' }, counted);

            expect(writes).toBe(0);
            expect(result).toEqual([{ symbol: 'LAES', label: 'LAES' }]);
        });

        it('빈 문자열 라벨은 무시한다', () => {
            const storage = createMemoryStorage();
            storage.setItem(
                RECENT_SEARCHES_STORAGE_KEY,
                JSON.stringify([{ symbol: 'IONQ', label: 'IONQ' }])
            );

            expect(relabelRecentSearches({ IONQ: '   ' }, storage)).toEqual([
                { symbol: 'IONQ', label: 'IONQ' },
            ]);
        });

        it('storage가 null이면 빈 배열을 반환한다', () => {
            expect(relabelRecentSearches({ AAPL: '애플' }, null)).toEqual([]);
        });
    });

    describe('storage getItem error', () => {
        it('getItem이 throw하면 에러가 전파된다', () => {
            const storage = {
                getItem: () => {
                    throw new Error('SecurityError');
                },
                setItem: () => {},
                removeItem: () => {},
            };
            expect(() => getRecentSearches(storage)).toThrow('SecurityError');
        });
    });
});
