import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import {
    publishSymbolAnalyzed,
    subscribeSymbolAnalyzed,
} from '@/shared/lib/symbolAnalyzedSignal';

describe('nudgeSession', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('표시 전에는 false, 표시를 기록하면 true', () => {
        expect(hasNudgeShownThisSession()).toBe(false);
        markNudgeShownThisSession();
        expect(hasNudgeShownThisSession()).toBe(true);
    });

    it('저장소가 막혀 있으면 던지지 않고 "아직 안 띄움"으로 본다', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        try {
            expect(hasNudgeShownThisSession()).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('symbolAnalyzedSignal', () => {
    it('구독자에게 심볼을 전달하고, 구독 해제 뒤에는 전달하지 않는다', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSymbolAnalyzed(listener);

        publishSymbolAnalyzed('AAPL');
        unsubscribe();
        publishSymbolAnalyzed('TSLA');

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith('AAPL');
    });
});
