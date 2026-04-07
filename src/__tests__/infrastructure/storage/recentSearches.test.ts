import {
    MAX_RECENT_SEARCHES,
    RECENT_SEARCHES_STORAGE_KEY,
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
} from '@/infrastructure/storage/recentSearches';

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
            expect(getRecentSearches(storage)).toEqual(['AAPL', 'TSLA']);
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
            expect(result).toEqual(['AAPL']);
        });

        it('대문자로 정규화하고 trim한다', () => {
            const storage = createMemoryStorage();
            const result = addRecentSearch('  aapl  ', storage);
            expect(result).toEqual(['AAPL']);
        });

        it('빈 문자열은 무시한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            const result = addRecentSearch('   ', storage);
            expect(result).toEqual(['AAPL']);
        });

        it('중복 검색 시 기존 항목을 제거하고 최상단으로 이동한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            addRecentSearch('TSLA', storage);
            addRecentSearch('NVDA', storage);
            const result = addRecentSearch('AAPL', storage);
            expect(result).toEqual(['AAPL', 'NVDA', 'TSLA']);
        });

        it('최대 개수를 초과하면 가장 오래된 항목을 제거한다', () => {
            const storage = createMemoryStorage();
            for (let i = 0; i < MAX_RECENT_SEARCHES; i++) {
                addRecentSearch(`T${i}`, storage);
            }
            const result = addRecentSearch('NEW', storage);
            expect(result).toHaveLength(MAX_RECENT_SEARCHES);
            expect(result[0]).toBe('NEW');
            expect(result).not.toContain('T0');
        });

        it('storage가 null이어도 정규화된 결과를 반환한다', () => {
            const result = addRecentSearch('aapl', null);
            expect(result).toEqual(['AAPL']);
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

    describe('removeRecentSearch', () => {
        it('해당 종목을 제거한다', () => {
            const storage = createMemoryStorage();
            addRecentSearch('AAPL', storage);
            addRecentSearch('TSLA', storage);
            const result = removeRecentSearch('AAPL', storage);
            expect(result).toEqual(['TSLA']);
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
});
