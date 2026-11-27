import { canReceiveSymbolAlerts } from '@/features/mail-alert/lib/canReceiveSymbolAlerts';
import type { AssetInfo } from '@/shared/lib/types';

const asset = (overrides: Partial<AssetInfo>): AssetInfo => ({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    ...overrides,
});

describe('canReceiveSymbolAlerts', () => {
    it('프로필 표시가 없는 옛 주식 행은 미국 주식으로 보고 허용한다', () => {
        expect(canReceiveSymbolAlerts(asset({}))).toBe(true);
    });

    it('한국 주식은 허용한다', () => {
        expect(
            canReceiveSymbolAlerts(
                asset({ symbol: '005930.KS', marketProfile: 'kr-equity' })
            )
        ).toBe(true);
    });

    it('크립토는 막는다', () => {
        expect(
            canReceiveSymbolAlerts(
                asset({ symbol: 'BTCUSD', marketProfile: 'crypto' })
            )
        ).toBe(false);
    });

    it('지수(FMP 심볼이 ^로 시작)는 막는다', () => {
        expect(
            canReceiveSymbolAlerts(asset({ symbol: 'SPX', fmpSymbol: '^SPX' }))
        ).toBe(false);
    });

    it('자산 정보가 없으면 막는다', () => {
        expect(canReceiveSymbolAlerts(null)).toBe(false);
        expect(canReceiveSymbolAlerts(undefined)).toBe(false);
    });
});
