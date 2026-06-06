import { describe, it, expect } from 'vitest';
import {
    WILLIAMS_R_OVERBOUGHT_LEVEL,
    WILLIAMS_R_OVERSOLD_LEVEL,
    BOLLINGER_PERCENT_B_UPPER_LEVEL,
    BOLLINGER_PERCENT_B_LOWER_LEVEL,
    HURST_RANDOM_WALK_LEVEL,
    VARIANCE_RATIO_RANDOM_WALK_LEVEL,
} from '../../constants/indicatorLevels';

describe('indicatorLevels', () => {
    it('Williams %R bounds', () => {
        expect(WILLIAMS_R_OVERBOUGHT_LEVEL).toBe(-20);
        expect(WILLIAMS_R_OVERSOLD_LEVEL).toBe(-80);
    });
    it('Bollinger %B bounds', () => {
        expect(BOLLINGER_PERCENT_B_UPPER_LEVEL).toBe(1);
        expect(BOLLINGER_PERCENT_B_LOWER_LEVEL).toBe(0);
    });
    it('random-walk reference levels', () => {
        expect(HURST_RANDOM_WALK_LEVEL).toBe(0.5);
        expect(VARIANCE_RATIO_RANDOM_WALK_LEVEL).toBe(1);
    });
});
