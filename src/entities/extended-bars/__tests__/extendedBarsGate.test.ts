import { describe, expect, it } from 'vitest';
import { isExtendedBarsFetchEnabled } from '@/entities/extended-bars/lib/extendedBarsGate';

describe('isExtendedBarsFetchEnabled — 조회 자격 행렬', () => {
    const base = {
        marketProfile: 'us-equity',
        timeframe: '5Min',
        toggledOn: true,
        humanInteracted: true,
    } as const;

    it('미국 주식·인트라데이·토글 켜짐·사람 입력 있음이면 켠다', () => {
        expect(isExtendedBarsFetchEnabled(base)).toBe(true);
    });

    it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour'] as const)(
        '%s는 켠다',
        timeframe => {
            expect(isExtendedBarsFetchEnabled({ ...base, timeframe })).toBe(
                true
            );
        }
    );

    it('1Day는 끈다', () => {
        expect(isExtendedBarsFetchEnabled({ ...base, timeframe: '1Day' })).toBe(
            false
        );
    });

    it.each(['kr-equity', 'crypto'] as const)('%s는 끈다', marketProfile => {
        expect(isExtendedBarsFetchEnabled({ ...base, marketProfile })).toBe(
            false
        );
    });

    it('토글이 꺼져 있으면 끈다', () => {
        expect(isExtendedBarsFetchEnabled({ ...base, toggledOn: false })).toBe(
            false
        );
    });

    it('사람 입력이 없으면(크롤러·SSR 직후) 끈다', () => {
        expect(
            isExtendedBarsFetchEnabled({ ...base, humanInteracted: false })
        ).toBe(false);
    });
});
