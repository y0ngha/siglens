import { act, render, renderHook } from '@testing-library/react';
import { useRecentSymbols } from '@/features/watchlist/hooks/useRecentSymbols';
import { RecordRecentSymbol } from '@/features/watchlist/ui/RecordRecentSymbol';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';

describe('useRecentSymbols', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-11T00:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('record가 목록과 저장소에 반영된다', () => {
        const { result } = renderHook(() => useRecentSymbols());
        expect(result.current.entries).toEqual([]);
        act(() => result.current.record({ symbol: 'nvda', label: '엔비디아' }));
        expect(result.current.entries).toEqual([
            {
                symbol: 'NVDA',
                label: '엔비디아',
                viewedAt: Date.parse('2026-10-11T00:00:00.000Z'),
            },
        ]);
        expect(
            localStorage.getItem(LOCAL_STORAGE_RECENT_SYMBOLS_KEY)
        ).toContain('NVDA');
    });

    it('다른 탭의 storage 이벤트를 반영한다', () => {
        const { result } = renderHook(() => useRecentSymbols());
        act(() => {
            localStorage.setItem(
                LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
                JSON.stringify([{ symbol: 'AAPL', label: '애플', viewedAt: 1 }])
            );
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
                })
            );
        });
        expect(result.current.entries.map(e => e.symbol)).toEqual(['AAPL']);
    });

    describe('영속 문자열 계약', () => {
        it('저장 키는 배포된 값과 같다', () => {
            expect(LOCAL_STORAGE_RECENT_SYMBOLS_KEY).toBe(
                'siglens:recent-symbols:v1'
            );
        });

        it('리터럴 키로 쓰고 리터럴 이벤트를 보내면 같은 탭 구독자가 갱신된다', () => {
            const { result } = renderHook(() => useRecentSymbols());
            act(() => {
                localStorage.setItem(
                    'siglens:recent-symbols:v1',
                    JSON.stringify([
                        { symbol: 'AMD', label: 'AMD', viewedAt: 1 },
                    ])
                );
                window.dispatchEvent(
                    new Event('siglens:recent-symbols-change')
                );
            });
            expect(result.current.entries.map(e => e.symbol)).toEqual(['AMD']);
        });
    });
});

describe('RecordRecentSymbol', () => {
    beforeEach(() => localStorage.clear());

    it('마운트하면 그 종목을 최근 본 목록에 남기고 아무것도 그리지 않는다', () => {
        const { container } = render(
            <RecordRecentSymbol symbol="TSLA" label="테슬라" />
        );
        expect(container).toBeEmptyDOMElement();
        expect(
            JSON.parse(
                localStorage.getItem(LOCAL_STORAGE_RECENT_SYMBOLS_KEY) ?? '[]'
            )[0]
        ).toMatchObject({ symbol: 'TSLA', label: '테슬라' });
    });
});
