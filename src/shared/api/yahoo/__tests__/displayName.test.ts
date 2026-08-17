import { describe, it, expect } from 'vitest';
import { isGarbledYahooName, pickYahooDisplayName } from '../displayName';

describe('isGarbledYahooName', () => {
    it('detects the comma-joined code string yahoo returns for some KRX symbols', () => {
        // 실측(2026-08-16): 900140.KQ / 224760.KQ
        expect(
            isGarbledYahooName('900140.KQ,0P0000RVWF,493004', '900140.KQ')
        ).toBe(true);
        expect(isGarbledYahooName('224760.KQ,0P00017O1R,12', '224760.KQ')).toBe(
            true
        );
    });

    it('does not flag legitimate names that merely contain a comma', () => {
        // 정상 사명에 콤마는 흔하다 — 콤마만으로 판정하면 대부분을 버리게 된다.
        expect(
            isGarbledYahooName('Samsung Electronics Co., Ltd.', '005930.KS')
        ).toBe(false);
        expect(isGarbledYahooName('Hyundai Mobis Co.,Ltd', '012330.KS')).toBe(
            false
        );
        expect(isGarbledYahooName('EcoPro BM Co., Ltd.', '247540.KQ')).toBe(
            false
        );
    });

    it('does not flag a name starting with the symbol but having no comma', () => {
        expect(isGarbledYahooName('HPSP Co., Ltd.', 'HPSP')).toBe(false);
    });
});

describe('pickYahooDisplayName', () => {
    it('prefers the first usable candidate', () => {
        expect(
            pickYahooDisplayName(
                '005930.KS',
                'Samsung Electronics Co., Ltd.',
                'SamsungElec'
            )
        ).toBe('Samsung Electronics Co., Ltd.');
    });

    it('skips a garbled candidate and falls through', () => {
        expect(
            pickYahooDisplayName(
                '900140.KQ',
                '900140.KQ,0P0000RVWF,493004',
                'LVMC Holdings'
            )
        ).toBe('LVMC Holdings');
    });

    it('falls back to the symbol when every candidate is unusable', () => {
        expect(
            pickYahooDisplayName(
                '900140.KQ',
                '900140.KQ,0P0000RVWF,493004',
                undefined,
                null,
                '   '
            )
        ).toBe('900140.KQ');
    });

    it('trims surrounding whitespace', () => {
        expect(pickYahooDisplayName('AAPL', '  Apple Inc.  ')).toBe(
            'Apple Inc.'
        );
    });
});
