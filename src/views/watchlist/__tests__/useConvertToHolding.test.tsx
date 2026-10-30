vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({ useToast: () => toast }));

import { renderHook } from '@testing-library/react';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { SavePortfolioResult } from '@/entities/portfolio/model';
import { useConvertToHolding } from '@/views/watchlist/hooks/useConvertToHolding';

const mockUseHoldings = vi.mocked(usePortfolioHoldings);
type Holdings = ReturnType<typeof usePortfolioHoldings>;

// 입력은 소문자 — 관심 항목 삭제가 입력이 아니라 저장된 보유의 심볼을 쓰는지 가른다.
const INPUT = { symbol: 'aapl', quantity: '10', averagePrice: '150' };
const SAVED: SavePortfolioResult = {
    status: 'ok',
    holding: {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        fmpSymbol: 'AAPL',
        quantity: '10',
        averagePrice: '150',
        updatedAt: '2026-10-29T00:00:00.000Z',
    },
};
const REJECTED: SavePortfolioResult = {
    status: 'error',
    code: 'invalid_quantity',
    message: '수량을 확인해 주세요',
};

function setSave(result: SavePortfolioResult, isPending = false) {
    const save = {
        mutateAsync: vi.fn(async () => result),
        isPending,
    } as unknown as Holdings['save'];
    mockUseHoldings.mockReturnValue({
        holdings: [],
        hasData: false,
        isHydrated: true,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        save,
        remove: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['remove'],
    });
    return save;
}

describe('useConvertToHolding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('보유 목록은 읽지 않고 저장 변이만 쓴다(enabled: false)', () => {
        setSave(SAVED);
        renderHook(() => useConvertToHolding(vi.fn(async () => true)));
        expect(mockUseHoldings).toHaveBeenCalledWith({ enabled: false });
    });

    it('isSaving은 저장 변이의 isPending을 따른다', () => {
        setSave(SAVED, true);
        const { result } = renderHook(() =>
            useConvertToHolding(vi.fn(async () => true))
        );
        expect(result.current.isSaving).toBe(true);
    });

    describe('저장이 error면', () => {
        it('저장 결과를 그대로 돌려준다', async () => {
            setSave(REJECTED);
            const { result } = renderHook(() =>
                useConvertToHolding(vi.fn(async () => true))
            );
            await expect(result.current.convert(INPUT)).resolves.toBe(REJECTED);
        });

        it('관심 항목을 지우지 않고 토스트도 띄우지 않는다', async () => {
            setSave(REJECTED);
            const remove = vi.fn(async () => true);
            const { result } = renderHook(() => useConvertToHolding(remove));
            await result.current.convert(INPUT);
            expect(remove).not.toHaveBeenCalled();
            expect(toast.showToast).not.toHaveBeenCalled();
        });
    });

    describe('저장이 ok면', () => {
        it('입력을 그대로 저장한다', async () => {
            const save = setSave(SAVED);
            const { result } = renderHook(() =>
                useConvertToHolding(vi.fn(async () => true))
            );
            await result.current.convert(INPUT);
            expect(save.mutateAsync).toHaveBeenCalledWith({
                symbol: 'aapl',
                quantity: '10',
                averagePrice: '150',
            });
        });

        it('저장된 보유의 심볼로 관심 항목을 지우고 저장 결과를 돌려준다', async () => {
            setSave(SAVED);
            const remove = vi.fn(async () => true);
            const { result } = renderHook(() => useConvertToHolding(remove));
            await expect(result.current.convert(INPUT)).resolves.toBe(SAVED);
            expect(remove).toHaveBeenCalledWith('AAPL');
        });

        it('관심 항목 삭제도 성공하면 토스트를 띄우지 않는다', async () => {
            setSave(SAVED);
            const { result } = renderHook(() =>
                useConvertToHolding(vi.fn(async () => true))
            );
            await result.current.convert(INPUT);
            expect(toast.showToast).not.toHaveBeenCalled();
        });

        it('관심 항목 삭제가 실패해도 저장 결과는 그대로 돌려준다', async () => {
            setSave(SAVED);
            const { result } = renderHook(() =>
                useConvertToHolding(vi.fn(async () => false))
            );
            await expect(result.current.convert(INPUT)).resolves.toBe(SAVED);
        });

        it('관심 항목 삭제가 실패하면 무엇이 남았는지 알리는 토스트를 띄운다', async () => {
            setSave(SAVED);
            const { result } = renderHook(() =>
                useConvertToHolding(vi.fn(async () => false))
            );
            await result.current.convert(INPUT);
            expect(toast.showToast).toHaveBeenCalledWith({
                message:
                    '보유종목은 저장했지만 관심종목에서는 빼지 못했어요. 관심종목 페이지에서 직접 삭제해 주세요.',
            });
        });
    });
});
