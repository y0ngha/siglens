import { describe, it, expect } from 'vitest';
import { buildAssetAboutNode } from '../assetClassification';

describe('buildAssetAboutNode crypto handling', () => {
    it('omits the about node for crypto (no standard schema.org type)', () => {
        expect(
            buildAssetAboutNode('BTCUSD', 'Bitcoin USD', undefined, 'crypto')
        ).toBeUndefined();
    });
    it('still returns Corporation for equity stocks', () => {
        expect(buildAssetAboutNode('AAPL', 'Apple Inc.')).toEqual({
            '@type': 'Corporation',
            name: 'Apple Inc.',
            tickerSymbol: 'AAPL',
        });
    });
});
