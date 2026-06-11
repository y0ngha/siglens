import { describe, it, expect } from 'vitest';
import {
    MFI_OVERBOUGHT_LEVEL,
    MFI_OVERSOLD_LEVEL,
    CONNORS_RSI_OVERBOUGHT_LEVEL,
    CONNORS_RSI_OVERSOLD_LEVEL,
    CMF_ZERO_LEVEL,
    WILLIAMS_R_OVERBOUGHT_LEVEL,
    WILLIAMS_R_OVERSOLD_LEVEL,
    BOLLINGER_PERCENT_B_UPPER_LEVEL,
    BOLLINGER_PERCENT_B_LOWER_LEVEL,
    HURST_RANDOM_WALK_LEVEL,
    VARIANCE_RATIO_RANDOM_WALK_LEVEL,
    MACD_V_ZERO_LEVEL,
    FORCE_INDEX_ZERO_LEVEL,
} from '../../constants/indicatorLevels';

describe('indicatorLevels', () => {
    // MFI·CRSI·CMF는 core 배럴이 export하지 않아 로컬 하드코딩한 값이라(파일 JSDoc
    // 참조) drift 위험이 가장 크다 — 정확한 값을 단언으로 고정한다.
    it('MFI bounds (local, core barrel lacks them)', () => {
        expect(MFI_OVERBOUGHT_LEVEL).toBe(80);
        expect(MFI_OVERSOLD_LEVEL).toBe(20);
    });
    it('Connors RSI bounds (local, mirrors core CRSI convention)', () => {
        expect(CONNORS_RSI_OVERBOUGHT_LEVEL).toBe(90);
        expect(CONNORS_RSI_OVERSOLD_LEVEL).toBe(10);
    });
    it('CMF zero-cross level', () => {
        expect(CMF_ZERO_LEVEL).toBe(0);
    });
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
    it('group-C zero levels', () => {
        expect(MACD_V_ZERO_LEVEL).toBe(0);
        expect(FORCE_INDEX_ZERO_LEVEL).toBe(0);
    });
});
