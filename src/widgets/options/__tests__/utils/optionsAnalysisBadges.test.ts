import {
    SIGNAL_KIND_CLASS,
    SIGNAL_KIND_LABEL_KEY,
    TONE_CLASS,
    TONE_LABEL_KEY,
} from '@/widgets/options/utils/optionsAnalysisBadges';

describe('optionsAnalysisBadges', () => {
    it('maps every tone to a label key under optionsTone', () => {
        expect(
            Object.values(TONE_LABEL_KEY).every(k =>
                k.startsWith('optionsTone.')
            )
        ).toBe(true);
        expect(Object.keys(TONE_LABEL_KEY).sort()).toEqual([
            'bearish',
            'bullish',
            'cautious',
            'neutral',
        ]);
    });

    it('maps every signal kind to a label key under optionsSignalKind', () => {
        expect(
            Object.values(SIGNAL_KIND_LABEL_KEY).every(k =>
                k.startsWith('optionsSignalKind.')
            )
        ).toBe(true);
    });

    it('uses -text variants for badge text on every tone', () => {
        expect(TONE_CLASS.bullish.text).toBe('text-ui-success-text');
        expect(TONE_CLASS.bearish.text).toBe('text-ui-danger-text');
        expect(TONE_CLASS.cautious.text).toBe('text-ui-warning-text');
    });

    it('styles volatility signals like cautious tone', () => {
        expect(SIGNAL_KIND_CLASS.volatility).toBe(TONE_CLASS.cautious);
    });

    it('styles bullish, bearish and neutral signals like the matching tone', () => {
        expect(SIGNAL_KIND_CLASS.bullish).toBe(TONE_CLASS.bullish);
        expect(SIGNAL_KIND_CLASS.bearish).toBe(TONE_CLASS.bearish);
        expect(SIGNAL_KIND_CLASS.neutral).toBe(TONE_CLASS.neutral);
    });
});
