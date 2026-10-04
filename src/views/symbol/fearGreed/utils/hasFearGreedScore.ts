import { computeFearGreedIndex, type BarsData } from '@y0ngha/siglens-core';

/**
 * 종목 공포·탐욕 탭에 **점수가 그려지는가** — 색인 게이트(`generateMetadata`)와 본문
 * (`FearGreedFactsSummary` 렌더 여부)이 함께 쓰는 단일 술어다.
 *
 * `FearGreedFactsSummary`는 `computeFearGreedIndex(bars, buySellVolume)`가 null이면
 * 아무것도 그리지 않는다. 예전 게이트는 `buildTechnicalFacts !== null`(봉 2개 이상)이라
 * 봉은 있으나 점수 표본이 모자란 종목(`/TOSCF/fear-greed`·`/SLROF/fear-greed`,
 * 2026-10-04 실측: 본문이 도입 문단 450자뿐)이 `index, follow`로 열려 있었다.
 *
 * 입력은 `FearGreedFactsSummary` props와 같다: `bars`와 `indicators.buySellVolume`.
 * 요약 컴포넌트가 읽는 입력을 바꾸면 이 함수도 같이 바꿔야 한다.
 */
export function hasFearGreedScore(
    barsData: Pick<BarsData, 'bars'> & {
        indicators: Pick<BarsData['indicators'], 'buySellVolume'>;
    }
): boolean {
    return (
        computeFearGreedIndex(
            barsData.bars,
            barsData.indicators.buySellVolume
        ) !== null
    );
}
