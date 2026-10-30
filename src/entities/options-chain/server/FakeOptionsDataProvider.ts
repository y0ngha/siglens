import type {
    OptionsContract,
    OptionsDataProvider,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

const UNDERLYING_PRICE = 195.7;
// 고정된 E2E 시계(2026-05-30)로부터 달력 6일 뒤인 금요일 위클리 만기.
const EXPIRATION_DATE = '2026-06-05';
const DAYS_TO_EXPIRATION = 6;
const STRIKES = [185, 190, 195, 200, 205] as const;

// 계약별 합성 지표. 값은 임의이지만 그럴듯하게 잡아, E2E에서 옵션 페이지가 결정적인
// 지표 카드를 그리게 한다.
const FAKE_MIN_LAST_PRICE = 0.5; // 깊은 ITM/OTM 다리가 0원으로 매겨지지 않게 하는 하한
const FAKE_SPREAD = 0.1; // lastPrice 기준 bid/ask 오프셋
const FAKE_VOLUME = 1_000;
const FAKE_OPEN_INTEREST = 5_000;
const FAKE_IMPLIED_VOL = 0.3;

function makeContract(
    strike: number,
    side: 'C' | 'P',
    inTheMoney: boolean
): OptionsContract {
    const lastPrice = Math.max(
        FAKE_MIN_LAST_PRICE,
        Math.abs(UNDERLYING_PRICE - strike)
    );
    return {
        contractSymbol: `AAPL260605${side}${String(strike * 1000).padStart(8, '0')}`,
        strike,
        lastPrice,
        bid: lastPrice - FAKE_SPREAD,
        ask: lastPrice + FAKE_SPREAD,
        volume: FAKE_VOLUME,
        openInterest: FAKE_OPEN_INTEREST,
        impliedVolatility: FAKE_IMPLIED_VOL,
        inTheMoney,
    };
}

/**
 * E2E 전용 `OptionsDataProvider` — Yahoo Finance 대신 결정적이고 던지지 않는 스냅샷을 돌려준다.
 * `E2E_TEST=1`일 때만 `getOptionsProvider`가 고른다. env 키를 읽지 않고 네트워크 I/O도 없다.
 *
 * 스냅샷은 만기 1개에 좌우 대칭 콜/풋 사다리를 담아, 옵션 페이지가 Max Pain · put-call ratio ·
 * top-OI strike를 계산하고 지표 카드를 그리게 한다(symbol-tabs 스펙이 "Max Pain" 카드를 단언한다).
 */
export class FakeOptionsDataProvider implements OptionsDataProvider {
    async fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null> {
        const calls = STRIKES.map(strike =>
            makeContract(strike, 'C', strike < UNDERLYING_PRICE)
        );
        const puts = STRIKES.map(strike =>
            makeContract(strike, 'P', strike > UNDERLYING_PRICE)
        );
        return {
            symbol: symbol.toUpperCase(),
            underlyingPrice: UNDERLYING_PRICE,
            chains: [
                {
                    expirationDate: EXPIRATION_DATE,
                    daysToExpiration: DAYS_TO_EXPIRATION,
                    calls,
                    puts,
                },
            ],
            capturedAt: '2026-05-30T20:00:00.000Z',
        };
    }

    async hasOptionsMarket(_symbol: string): Promise<boolean> {
        return true;
    }
}
