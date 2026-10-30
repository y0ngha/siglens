vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');

import { act, renderHook } from '@testing-library/react';
import { usePortfolioSection } from '@/features/portfolio-management/hooks/usePortfolioSection';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type {
    PortfolioHoldingView,
    SavePortfolioResult,
} from '@/entities/portfolio/model';

const mockUsePortfolioHoldings = vi.mocked(usePortfolioHoldings);

type Holdings = ReturnType<typeof usePortfolioHoldings>;

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

const OK_SAVE: SavePortfolioResult = { status: 'ok', holding: HOLDING };
const INPUT = { symbol: 'AAPL', quantity: '10', averagePrice: '150.5' };

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>(r => {
        resolve = r;
    });
    return { promise, resolve };
}

function setHoldings(overrides: Partial<Holdings> = {}) {
    const base: Holdings = {
        holdings: [HOLDING],
        hasData: true,
        isHydrated: true,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        save: {
            mutateAsync: vi.fn().mockResolvedValue(OK_SAVE),
            isPending: false,
        } as unknown as Holdings['save'],
        remove: {
            mutateAsync: vi.fn().mockResolvedValue({ status: 'ok' }),
            isPending: false,
            variables: undefined,
        } as unknown as Holdings['remove'],
    };
    const merged = { ...base, ...overrides };
    mockUsePortfolioHoldings.mockReturnValue(merged);
    return merged;
}

describe('usePortfolioSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports loading before hydration', () => {
        setHoldings({ isHydrated: false });
        const { result } = renderHook(() => usePortfolioSection({}));
        expect(result.current.listView).toBe('loading');
    });

    it('reports error instead of empty when the list query failed', () => {
        setHoldings({ holdings: [], isError: true });
        const { result } = renderHook(() => usePortfolioSection({}));
        expect(result.current.listView).toBe('error');
    });

    it('reports list when holdings are loaded', () => {
        setHoldings();
        const { result } = renderHook(() => usePortfolioSection({}));
        expect(result.current.listView).toBe('list');
    });

    it('closes delete confirm when an edit starts', () => {
        setHoldings();
        const { result } = renderHook(() => usePortfolioSection({}));

        act(() => result.current.requestDelete('AAPL'));
        act(() => result.current.startEdit('AAPL'));

        expect(result.current.confirmingDeleteSymbol).toBeNull();
        expect(result.current.editingSymbol).toBe('AAPL');
    });

    it('closes the edited row and announces after a successful edit save', async () => {
        const onHoldingsChange = vi.fn();
        setHoldings();
        const { result } = renderHook(() =>
            usePortfolioSection({ onHoldingsChange })
        );
        act(() => result.current.startEdit('AAPL'));

        await act(() => result.current.saveEdit('AAPL', INPUT));

        expect(result.current.editingSymbol).toBeNull();
        expect(result.current.statusMessage).toBe('AAPL 보유종목을 저장했어요');
        expect(onHoldingsChange).toHaveBeenCalledTimes(1);
    });

    it('keeps another row open when an earlier edit save resolves late', async () => {
        const pending = deferred<SavePortfolioResult>();
        const { save } = setHoldings();
        vi.mocked(save.mutateAsync).mockReturnValue(pending.promise);
        const { result } = renderHook(() => usePortfolioSection({}));
        act(() => result.current.startEdit('AAPL'));
        const saving = result.current.saveEdit('AAPL', INPUT);

        act(() => result.current.startEdit('MSFT'));
        await act(async () => {
            pending.resolve(OK_SAVE);
            await saving;
        });

        expect(result.current.editingSymbol).toBe('MSFT');
    });

    it('keeps another row open when an earlier row cancels its edit', () => {
        setHoldings();
        const { result } = renderHook(() => usePortfolioSection({}));
        act(() => result.current.startEdit('MSFT'));

        act(() => result.current.cancelEdit('AAPL'));

        expect(result.current.editingSymbol).toBe('MSFT');
    });

    it('marks only the row whose delete is in flight as deleting', () => {
        setHoldings({
            remove: {
                mutateAsync: vi.fn(),
                isPending: true,
                variables: 'AAPL',
            } as unknown as Holdings['remove'],
        });
        const { result } = renderHook(() => usePortfolioSection({}));

        expect(result.current.deletingSymbol).toBe('AAPL');
    });

    it('keeps another row in delete confirm when an earlier delete resolves late', async () => {
        const pending = deferred<{ status: 'ok' }>();
        const { remove } = setHoldings();
        vi.mocked(remove.mutateAsync).mockReturnValue(pending.promise);
        const { result } = renderHook(() => usePortfolioSection({}));
        act(() => result.current.requestDelete('AAPL'));
        const deleting = result.current.confirmDelete('AAPL');

        act(() => result.current.requestDelete('MSFT'));
        await act(async () => {
            pending.resolve({ status: 'ok' });
            await deleting;
        });

        expect(result.current.confirmingDeleteSymbol).toBe('MSFT');
    });

    it('records the action message against the row when a delete returns an error', async () => {
        const { remove } = setHoldings();
        vi.mocked(remove.mutateAsync).mockResolvedValue({
            status: 'error',
            code: 'unknown',
            message: '삭제 실패',
        });
        const { result } = renderHook(() => usePortfolioSection({}));

        await act(() => result.current.confirmDelete('AAPL'));

        expect(result.current.deleteError).toEqual({
            symbol: 'AAPL',
            message: '삭제 실패',
        });
    });

    it('records the generic message against the row when a delete rejects', async () => {
        const { remove } = setHoldings();
        vi.mocked(remove.mutateAsync).mockRejectedValue(new Error('outage'));
        const { result } = renderHook(() => usePortfolioSection({}));

        await act(() => result.current.confirmDelete('AAPL'));

        expect(result.current.deleteError).toEqual({
            symbol: 'AAPL',
            message: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.',
        });
    });

    it('announces a successful delete and calls onHoldingsChange', async () => {
        const onHoldingsChange = vi.fn();
        setHoldings();
        const { result } = renderHook(() =>
            usePortfolioSection({ onHoldingsChange })
        );
        act(() => result.current.requestDelete('AAPL'));

        await act(() => result.current.confirmDelete('AAPL'));

        expect(result.current.confirmingDeleteSymbol).toBeNull();
        expect(result.current.statusMessage).toBe('AAPL 보유종목을 삭제했어요');
        expect(onHoldingsChange).toHaveBeenCalledTimes(1);
    });

    it('does not call onHoldingsChange after a failed add', async () => {
        const onHoldingsChange = vi.fn();
        const { save } = setHoldings();
        vi.mocked(save.mutateAsync).mockResolvedValue({
            status: 'error',
            code: 'invalid_symbol',
            message: '종목 오류',
        });
        const { result } = renderHook(() =>
            usePortfolioSection({ onHoldingsChange })
        );

        await act(() => result.current.addHolding(INPUT));

        expect(onHoldingsChange).not.toHaveBeenCalled();
        expect(result.current.statusMessage).toBeNull();
    });
});
