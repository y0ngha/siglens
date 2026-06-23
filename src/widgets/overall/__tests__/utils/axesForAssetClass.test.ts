import { describe, it, expect } from 'vitest';
import {
    axesForAssetClass,
    CRYPTO_AXIS_ORDER,
    EQUITY_AXIS_ORDER,
} from '../../utils/axesForAssetClass';

describe('axesForAssetClass', () => {
    it('returns CRYPTO_AXIS_ORDER for crypto', () => {
        const result = axesForAssetClass('crypto');
        expect(result).toEqual(['technical', 'news']);
        expect(result).toEqual(CRYPTO_AXIS_ORDER);
        // same reference — module-level constant
        expect(result).toBe(CRYPTO_AXIS_ORDER);
    });

    it('returns EQUITY_AXIS_ORDER for equity', () => {
        const result = axesForAssetClass('equity');
        expect(result).toEqual(['technical', 'fundamental', 'news', 'options']);
        expect(result).toEqual(EQUITY_AXIS_ORDER);
        expect(result).toBe(EQUITY_AXIS_ORDER);
    });

    it('CRYPTO_AXIS_ORDER has exactly 2 axes', () => {
        expect(CRYPTO_AXIS_ORDER).toHaveLength(2);
    });

    it('EQUITY_AXIS_ORDER has exactly 4 axes', () => {
        expect(EQUITY_AXIS_ORDER).toHaveLength(4);
    });
});
