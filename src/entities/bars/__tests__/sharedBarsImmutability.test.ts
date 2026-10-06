import { describe, expect, it } from 'vitest';
import {
    US_EQUITY_SESSION,
    fetchBarsWithIndicators,
    type Bar,
    type BarsData,
    type GetBarsOptions,
    type MarketDataProvider,
} from '@y0ngha/siglens-core';
import { quantizeBarsDataToLastClosed } from '../lib/quantizeBars';
import {
    clientSymbolFearGreed,
    symbolFearGreedSnapshot,
} from '../lib/symbolFearGreed';

/**
 * 공유 값 불변 가드.
 *
 * `getCachedBarsWithIndicators`의 메모리 LRU와 `CachedMarketDataProvider`의 히스토리 L1은
 * 같은 객체(`BarsData`, `Bar[]`)를 여러 요청에 그대로 나눠 준다 — Redis에서 매번 새로
 * 역직렬화하던 때와 달리, 한 요청이 값을 고치면 다른 요청에 번진다. 운영에서 매번
 * deep-freeze하면 일봉 항목(~1.1MB) 순회 비용이 드니, 대신 여기서 얼린 값으로 서버 쪽
 * 소비 경로를 돌려 변경 시도가 있으면(strict mode에서 TypeError) 실패하게 한다.
 *
 * 새 서버 소비자가 `BarsData`를 받으면 여기에 추가한다. 클라이언트(`useBars`)는 직렬화된
 * 사본을 받으므로 대상이 아니다.
 */
function deepFreeze<T>(value: T): T {
    if (typeof value !== 'object' || value === null || Object.isFrozen(value))
        return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
}

const DAY_SECONDS = 86_400;
/**
 * 5년치 일봉으로 core 지표 전체 + 공포·탐욕을 여러 번 계산한다 — 로컬에선 1~2초지만
 * CI 러너(병렬 워커)에선 기본 5초에 걸려 실패한 적이 있다. 계산량 자체가 검증 대상이라
 * 봉 수를 줄이지 않고 상한만 넉넉히 둔다.
 */
const HEAVY_COMPUTE_TIMEOUT_MS = 30_000;
const NOW = new Date('2026-10-06T15:00:00Z'); // 화요일 11:00 ET — 정규장 중
const LAST_DAY = Math.floor(Date.parse('2026-10-06T00:00:00Z') / 1000);

/** 5년 남짓한 UTC 자정 일봉(주말 포함 — 계산 경로만 보면 된다). */
function dailyBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) => {
        const base = 100 + Math.sin(i / 7) * 10 + i * 0.05;
        return {
            time: LAST_DAY - (count - 1 - i) * DAY_SECONDS,
            open: base,
            high: base + 2,
            low: base - 2,
            close: base + Math.cos(i / 5),
            volume: 1_000_000 + (i % 13) * 10_000,
        };
    });
}

/** 히스토리 L1처럼 얼린 배열을 그대로 돌려주는 provider. */
function frozenProvider(bars: Bar[]): MarketDataProvider {
    const frozen = deepFreeze(bars);
    return {
        getBars: async (o: GetBarsOptions) =>
            o.from === undefined
                ? frozen
                : frozen.filter(
                      b => b.time >= Math.floor(Date.parse(o.from!) / 1000)
                  ),
        getQuote: async () => null,
    } as MarketDataProvider;
}

describe(
    '공유되는 봉 값은 서버 소비 경로에서 변경되지 않는다',
    { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
    () => {
        it('core 계산이 provider의 얼린 봉을 고치지 않는다', async () => {
            await expect(
                fetchBarsWithIndicators(
                    frozenProvider(dailyBars(1900)),
                    'AAPL',
                    '1Day',
                    undefined,
                    NOW
                )
            ).resolves.toMatchObject({ bars: expect.any(Array) });
        });

        it('얼린 BarsData로 quantize·공포탐욕 계산이 돈다', async () => {
            const data: BarsData = deepFreeze(
                await fetchBarsWithIndicators(
                    frozenProvider(dailyBars(1900)),
                    'AAPL',
                    '1Day',
                    undefined,
                    NOW
                )
            );
            expect(data.bars.length).toBeGreaterThan(0);

            const quantized = quantizeBarsDataToLastClosed(
                data,
                NOW,
                US_EQUITY_SESSION
            );
            expect(quantized.bars.length).toBe(data.bars.length - 1);

            expect(() => symbolFearGreedSnapshot(data)).not.toThrow();
            expect(() => clientSymbolFearGreed(data)).not.toThrow();
            expect(() => clientSymbolFearGreed(quantized)).not.toThrow();
        });
    }
);
