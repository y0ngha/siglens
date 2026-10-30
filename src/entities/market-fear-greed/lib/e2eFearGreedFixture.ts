import type { CryptoDailyBar, MarketDailyClose } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';

/** fixture 시리즈당 세션 수 — `confidence: 'normal'`에 필요한 185를 넉넉히 넘는다. */
const FIXTURE_SESSIONS = 400;

/** fixture 날짜의 기준일. 고정이라 렌더되는 `asOf`가 실행마다 흔들리지 않는다. */
const FIXTURE_ANCHOR_UTC = Date.UTC(2026, 0, 1);

/** 결정적 LCG — E2E fixture는 `Math.random`에 기대면 안 된다. */
function lcg(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

/** 심볼별 안정 시드 — 시리즈마다 모양은 다르지만 실행 간에는 바뀌지 않는다. */
function seedFor(symbol: string): number {
    return (
        [...symbol].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) % 100000
    );
}

/**
 * `E2E_TEST`에서만 쓰는 FMP·yahoo 일별 종가의 결정적 대역(`fetchDailyCloses`,
 * `fetchKrDailyCloses` 소비).
 *
 * CI는 일부러 FMP 키 없이 E2E를 돌리므로, 이게 없으면 `/fear-greed` 페이지는 "표본 부족"
 * 상태로만 검증되고 게이지·비교 행·요인 막대가 끝까지 검증되지 않는다. 심볼별로 시드한
 * 랜덤 워크가 모든 요인에 순위를 매길 퇴화하지 않은 이력을 줘서 실제 점수가 나온다.
 * 정확한 숫자는 의미가 없으니 spec이 단언하면 안 된다.
 */
export function e2eDailyCloses(symbol: string): MarketDailyClose[] {
    const next = lcg(seedFor(symbol));
    let close = 100;

    return Array.from({ length: FIXTURE_SESSIONS }, (_, i) => {
        close *= 1 + (next() - 0.5) * 0.04;
        return {
            date: new Date(FIXTURE_ANCHOR_UTC + i * MS_PER_DAY)
                .toISOString()
                .slice(0, 10),
            close,
        };
    });
}

/**
 * `e2eDailyCloses`에 결정적 거래량을 붙인 암호화폐 일봉. `volume_flow` 요인이 상승일
 * 거래량 비중을 보므로 상수 거래량이면 요인이 퇴화한다 — 심볼별 난수열을 따로 쓴다.
 */
export function e2eCryptoDailyBars(symbol: string): CryptoDailyBar[] {
    const next = lcg(seedFor(`${symbol}:volume`));
    return e2eDailyCloses(symbol).map(bar => ({
        ...bar,
        volume: 1_000_000 * (0.5 + next()),
    }));
}
