import { describe, expect, it } from 'vitest';
import { displayTicker } from '../displayTicker';

describe('displayTicker', () => {
    it('국내 상장 종목은 거래소 접미사를 뗀다', () => {
        expect(displayTicker('000660.KS')).toBe('000660');
        expect(displayTicker('247540.KQ')).toBe('247540');
    });

    it('소문자 접미사도 국내 종목이면 뗀다', () => {
        expect(displayTicker('000660.ks')).toBe('000660');
        expect(displayTicker('247540.Kq')).toBe('247540');
    });

    it('미국 티커와 크립토는 그대로 둔다', () => {
        expect(displayTicker('AAPL')).toBe('AAPL');
        expect(displayTicker('BRK.B')).toBe('BRK.B');
        expect(displayTicker('BTCUSD')).toBe('BTCUSD');
    });
});
