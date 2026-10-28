import { assetTypeBadgeKey } from '../assetTypeBadge';

describe('assetTypeBadgeKey', () => {
    it.each([
        ['Stock', 'stock'],
        ['Stock Option', 'option'],
        ['OPTION', 'option'],
        ['Cryptocurrency', 'other'],
        ['', 'other'],
    ])('%s -> %s', (input, expected) => {
        expect(assetTypeBadgeKey(input)).toBe(expected);
    });
});
