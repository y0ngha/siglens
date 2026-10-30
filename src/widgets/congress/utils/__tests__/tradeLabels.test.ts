import {
    CHAMBER_LABEL,
    OWNER_LABEL,
    SIDE_BG_CLASS,
    SIDE_LABEL,
} from '../tradeLabels';

describe('tradeLabels', () => {
    it('uses empty-string sentinels only for unknown side/owner', () => {
        expect(SIDE_LABEL.unknown).toBe('');
        expect(OWNER_LABEL.unknown).toBe('');
        expect(SIDE_LABEL.buy).not.toBe('');
        expect(OWNER_LABEL.self).not.toBe('');
    });

    it('maps both chambers to catalog keys', () => {
        expect(CHAMBER_LABEL).toEqual({
            senate: 'chamber.senate',
            house: 'chamber.house',
        });
    });

    it('tints buy and sell but not unknown', () => {
        expect(SIDE_BG_CLASS.unknown).toBe('');
        expect(SIDE_BG_CLASS.buy).not.toBe(SIDE_BG_CLASS.sell);
    });
});
