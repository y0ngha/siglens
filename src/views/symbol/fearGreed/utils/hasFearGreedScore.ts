import type { BarsData } from '@y0ngha/siglens-core';
import { symbolFearGreedSnapshot } from '@/entities/bars/lib/symbolFearGreed';

/**
 * 종목 공포·탐욕 탭에 **점수가 그려지는가** — 색인 게이트(`generateMetadata`)와 본문
 * (`FearGreedFactsSummary` 렌더 여부)이 함께 쓰는 단일 술어다.
 *
 * `FearGreedFactsSummary`는 공포·탐욕 스냅샷이 null이면
 * 아무것도 그리지 않는다. 예전 게이트는 `buildTechnicalFacts !== null`(봉 2개 이상)이라
 * 봉은 있으나 점수 표본이 모자란 종목(`/TOSCF/fear-greed`·`/SLROF/fear-greed`,
 * 2026-10-04 실측: 본문이 도입 문단 450자뿐)이 `index, follow`로 열려 있었다.
 *
 * 입력은 `FearGreedFactsSummary`와 같은 공용 입구(`symbolFearGreedInputs` — 5년 일봉
 * `fearGreedBars`, 없으면 표준 봉)다. 요약이 읽는 입력을 바꾸면 이 함수도 같이 바꿔야 한다.
 */
export function hasFearGreedScore(barsData: BarsData): boolean {
    // 본문·헤더 배지와 같은 입구(5년 일봉)로 판정한다 — 입력이 갈리면 색인 게이트와
    // 화면이 서로 다른 점수를 보고 판정한다.
    return symbolFearGreedSnapshot(barsData) !== null;
}
