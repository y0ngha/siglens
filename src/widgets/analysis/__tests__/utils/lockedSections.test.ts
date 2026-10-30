import { resolveLockedSections } from '@/widgets/analysis/utils/lockedSections';

describe('resolveLockedSections', () => {
    it('잠긴 깊이가 없으면 모든 플래그가 false다', () => {
        expect(resolveLockedSections([])).toEqual({
            hasLockedDetails: false,
            hasLockedPartialDetail: false,
            hasLockedActionDetail: false,
            hasLockedConfidence: false,
        });
    });

    it.each(['entry', 'stoploss', 'target', 'full_detail'] as const)(
        '%s 잠금은 매매 전략 섹션을 잠근다',
        depth => {
            const result = resolveLockedSections([depth]);
            expect(result.hasLockedDetails).toBe(true);
            expect(result.hasLockedActionDetail).toBe(true);
            expect(result.hasLockedPartialDetail).toBe(false);
        }
    );

    it('partial_detail·confidence는 각자의 플래그만 켠다', () => {
        const result = resolveLockedSections(['partial_detail', 'confidence']);
        expect(result.hasLockedPartialDetail).toBe(true);
        expect(result.hasLockedConfidence).toBe(true);
        expect(result.hasLockedActionDetail).toBe(false);
    });
});
