import type { BarPrice } from 'lightweight-charts';
import { describe, expect, it } from 'vitest';
import { chartPriceFormat } from '../../utils/chartPriceFormat';

/** `formatter`는 브랜드 타입 `BarPrice`를 받는다. */
const show = (decimals: number, locale: 'ko' | 'en', price: number) =>
    chartPriceFormat(decimals, locale).formatter(price as BarPrice);

describe('chartPriceFormat', () => {
    it('groups thousands for KRW (whole won) and USD (cents) alike', () => {
        const krw = chartPriceFormat(0, 'ko');
        expect(show(0, 'ko', 215_500)).toBe('215,500');
        expect(show(0, 'ko', 1_000)).toBe('1,000');
        expect(show(0, 'ko', 10_000)).toBe('10,000');
        expect(krw.minMove).toBe(1);
        const usd = chartPriceFormat(2, 'en');
        expect(show(2, 'en', 64_192.5)).toBe('64,192.50');
        expect(show(2, 'en', 195.7)).toBe('195.70');
        expect(usd.minMove).toBe(0.01);
    });

    it('keeps sub-cent precision for small crypto quotes', () => {
        expect(show(8, 'en', 0.00012345)).toBe('0.00012345');
    });

    it('is a custom format so the price pane alone gets grouping', () => {
        expect(chartPriceFormat(2, 'ko').type).toBe('custom');
    });
});
