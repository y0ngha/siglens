import { MARKET_COMPARISON_LABEL_KEY } from '@/widgets/market-fear-greed/utils/marketComparisonLabelKey';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

describe('MARKET_COMPARISON_LABEL_KEY', () => {
    it('maps each lookback to its period message key', () => {
        expect(MARKET_COMPARISON_LABEL_KEY).toEqual({
            now: 'now',
            '1w': 'weekAgo',
            '1m': 'monthAgo',
            '1y': 'yearAgo',
        });
    });

    it.each([
        ['ko', koMessages],
        ['en', enMessages],
        ['ja', jaMessages],
        ['zh', zhMessages],
    ])(
        'every key resolves in the %s shared.ui.period catalog',
        (_, messages) => {
            const period: Record<string, string> = messages.shared.ui.period;
            const missing = Object.values(MARKET_COMPARISON_LABEL_KEY).filter(
                key => typeof period[key] !== 'string'
            );
            expect(missing).toEqual([]);
        }
    );
});
