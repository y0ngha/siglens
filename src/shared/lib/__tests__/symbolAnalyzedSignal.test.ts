import {
    publishSymbolAnalyzed,
    subscribeSymbolAnalyzed,
} from '@/shared/lib/symbolAnalyzedSignal';

describe('symbolAnalyzedSignal', () => {
    it('구독자 모두에게 같은 심볼을 전달한다', () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = subscribeSymbolAnalyzed(first);
        const offSecond = subscribeSymbolAnalyzed(second);

        publishSymbolAnalyzed('NVDA');
        offFirst();
        offSecond();

        expect(first).toHaveBeenCalledWith('NVDA');
        expect(second).toHaveBeenCalledWith('NVDA');
    });

    it('구독을 해제한 리스너는 다음 발행을 받지 않고, 나머지는 계속 받는다', () => {
        const removed = vi.fn();
        const kept = vi.fn();
        const offRemoved = subscribeSymbolAnalyzed(removed);
        const offKept = subscribeSymbolAnalyzed(kept);

        offRemoved();
        publishSymbolAnalyzed('AAPL');
        offKept();

        expect(removed).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it('구독자가 없으면 발행해도 아무 일도 없다', () => {
        expect(() => publishSymbolAnalyzed('TSLA')).not.toThrow();
    });
});
