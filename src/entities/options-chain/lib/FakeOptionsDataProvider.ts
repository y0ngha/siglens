import type {
    OptionsContract,
    OptionsDataProvider,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

/**
 * E2E-only `OptionsDataProvider` returning a deterministic, non-throwing
 * snapshot instead of calling Yahoo Finance. Reached only when E2E_TEST=1 (see
 * getOptionsProvider). Reads NO env keys and performs NO network I/O.
 *
 * The snapshot has one expiration with a small symmetric call/put ladder so the
 * options page can compute Max Pain / put-call ratio / top-OI strikes and
 * render its metric cards (the symbol-tabs spec asserts the "Max Pain" card).
 */

const UNDERLYING_PRICE = 195.7;
// 6 calendar days out from the frozen E2E clock (2026-05-30) — a Friday weekly.
const EXPIRATION_DATE = '2026-06-05';
const DAYS_TO_EXPIRATION = 6;
const STRIKES = [185, 190, 195, 200, 205] as const;

// Synthetic per-contract metrics. Values are arbitrary-but-plausible so the
// options page can render deterministic metric cards under E2E.
const FAKE_MIN_LAST_PRICE = 0.5; // floor so deep-ITM/OTM legs never price at 0
const FAKE_SPREAD = 0.1; // bid/ask offset around lastPrice
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
