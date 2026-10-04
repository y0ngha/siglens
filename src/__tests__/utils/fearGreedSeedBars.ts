import type { BarsData } from '@y0ngha/siglens-core';

/**
 * 공포·탐욕 탭 테스트가 공유하는 결정적 시드 봉 fixture.
 *
 * 실제 `getSeedBarsStatic` 산출물의 모양을 따른다 — `bars`는 전 구간, `buySellVolume`도
 * 전 구간, `rsi`·`macd`는 마지막 non-null **하나씩**만 담긴다(`barsStaticCache.ts`의
 * `keepLastNonNull`). 게이트 두 술어(`buildTechnicalFacts` 2봉 이상 /
 * `computeFearGreedIndex` 점수 표본)가 읽는 입력이 전부 실제 모양이라는 뜻이다.
 *
 * 봉 수만 바꿔 같은 모양으로 자를 수 있다. 실제 `computeFearGreedIndex`(2026-10-04
 * 실측 기준)는 40봉 이하에서 null, 41봉부터 `limited`, 100봉 이상에서 `normal`이다 —
 * `buildTechnicalFacts`는 2봉부터 값을 내므로 그 사이 구간(`/TOSCF`처럼 봉은 있으나
 * 점수 표본이 모자란 종목)이 두 술어가 갈리는 영역이다.
 */
export function buildFearGreedSeedBars(length: number): BarsData {
    const bars = Array.from({ length }, (_, i) => {
        const close = 100 + 10 * Math.sin(i / 9) + i * 0.05;
        return {
            time: 1_700_000_000 + i * 86_400,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1000 + (i % 7) * 50,
        };
    });
    const buySellVolume = Array.from({ length }, (_, i) => ({
        buyVolume: 500 + (i % 5) * 20,
        sellVolume: 500 - (i % 3) * 10,
    }));
    return {
        bars,
        indicators: {
            rsi: length > 0 ? [50] : [],
            macd:
                length > 0
                    ? [{ macd: 0.1, signal: 0.05, histogram: 0.05 }]
                    : [],
            buySellVolume,
        },
    } as unknown as BarsData;
}
