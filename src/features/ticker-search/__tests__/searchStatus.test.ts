import {
    deriveSearchState,
    searchStatus,
    type SearchStatusInput,
} from '@/features/ticker-search/lib/searchStatus';

const SETTLED_EMPTY: SearchStatusInput = {
    query: 'zzzz',
    hasQuery: true,
    isSearching: false,
    isError: false,
    resultCount: 0,
};

describe('searchStatus', () => {
    it('질의가 없으면 idle', () => {
        expect(
            searchStatus({ ...SETTLED_EMPTY, query: '', hasQuery: false })
        ).toBe('idle');
    });

    it('조회 중이면 결과 수와 무관하게 searching', () => {
        // 응답 전의 빈 결과를 "없음"으로 읽으면 고지가 번복된다.
        expect(searchStatus({ ...SETTLED_EMPTY, isSearching: true })).toBe(
            'searching'
        );
    });

    it('조회 중이면 실패 표시보다 searching이 먼저다', () => {
        expect(
            searchStatus({ ...SETTLED_EMPTY, isSearching: true, isError: true })
        ).toBe('searching');
    });

    it('실패하면 빈 결과여도 error', () => {
        expect(searchStatus({ ...SETTLED_EMPTY, isError: true })).toBe('error');
    });

    it('결과가 있으면 results', () => {
        expect(searchStatus({ ...SETTLED_EMPTY, resultCount: 2 })).toBe(
            'results'
        );
    });

    it('결과가 없고 영문 질의면 empty', () => {
        expect(searchStatus(SETTLED_EMPTY)).toBe('empty');
    });

    it('결과가 없고 한글 질의면 emptyKorean', () => {
        expect(searchStatus({ ...SETTLED_EMPTY, query: '삼성전자' })).toBe(
            'emptyKorean'
        );
    });
});

describe('deriveSearchState', () => {
    const snapshot = {
        results: [],
        isSearching: false,
        hasQuery: true,
        isError: false,
        debouncedQuery: 'apple',
    };

    it('입력의 앞뒤 공백을 떼면 debouncedQuery와 같을 때 settled', () => {
        expect(deriveSearchState('apple ', snapshot).isSettled).toBe(true);
    });

    it('debouncedQuery가 입력을 못 따라잡았으면 settled가 아니다', () => {
        expect(deriveSearchState('apples', snapshot).isSettled).toBe(false);
    });

    it('status는 searchStatus와 같은 우선순위로 정해진다', () => {
        expect(deriveSearchState('apple', snapshot).status).toBe('empty');
        expect(
            deriveSearchState('apple', { ...snapshot, isSearching: true })
                .status
        ).toBe('searching');
        expect(
            deriveSearchState('apple', { ...snapshot, results: [{}] }).status
        ).toBe('results');
    });
});
