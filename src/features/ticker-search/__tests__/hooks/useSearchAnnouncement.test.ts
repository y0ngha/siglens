// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useSearchAnnouncement } from '@/features/ticker-search/hooks/useSearchAnnouncement';
import type { SearchStatus } from '@/features/ticker-search/lib/searchStatus';

/** 번역 키와 보간 값을 그대로 돌려줘 어느 문구를 골랐는지만 본다. */
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: { v0: number }) =>
        values ? `${key}:${values.v0}` : key,
}));

describe('useSearchAnnouncement', () => {
    it.each<[SearchStatus, string]>([
        ['idle', 'search.typeToSearch'],
        ['searching', 'search.searching'],
        ['error', 'search.loadFailed'],
        ['emptyKorean', 'search.noResultsTryTicker'],
        ['empty', 'search.noResults'],
    ])('%s 상태는 %s 문구를 고지한다', (status, expected) => {
        const { result } = renderHook(() => useSearchAnnouncement(status, 0));
        expect(result.current).toBe(expected);
    });

    it('results 상태는 결과 수를 함께 고지한다', () => {
        const { result } = renderHook(() =>
            useSearchAnnouncement('results', 7)
        );
        expect(result.current).toBe('search.resultsCount:7');
    });
});
