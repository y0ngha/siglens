import { describe, it, expect } from 'vitest';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

describe('getMarketDataProvider', () => {
    it('같은 인스턴스를 반환한다(singleton)', () => {
        expect(getMarketDataProvider()).toBe(getMarketDataProvider());
    });
    it('FmpMarketProvider 인스턴스를 반환한다', () => {
        expect(getMarketDataProvider()).toBeInstanceOf(FmpMarketProvider);
    });
});
