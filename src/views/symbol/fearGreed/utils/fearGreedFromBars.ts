import type { BarsData } from '@y0ngha/siglens-core';
import {
    computeSymbolFearGreedSeries,
    symbolFearGreedInputs,
} from '@/entities/bars/lib/symbolFearGreed';
import {
    buildFearGreedMetaFacts,
    scoredHistory,
    type FearGreedMetaFacts,
    type ScoredPoint,
} from './fearGreedFacts';

/**
 * 봉에서 점수가 계산된 시계열 — `generateMetadata`(설명)와 페이지 본문(`dateModified`)이
 * **같은 함수**로 읽는다. 둘이 각자 조립하면 설명이 말하는 마지막 날짜와 `dateModified`의
 * 기준 봉이 갈릴 수 있다.
 *
 * 입력 고르기(`symbolFearGreedInputs`)와 계산(`computeSymbolFearGreedSeries`)은 둘 다
 * `React.cache`라 같은 `BarsData` 객체면 한 요청에서 한 번만 돈다 — 추가 provider 호출도,
 * 추가 5년 계산도 없다.
 */
export function scoredHistoryFromBars(data: BarsData): ScoredPoint[] {
    const input = symbolFearGreedInputs(data);
    return scoredHistory(
        computeSymbolFearGreedSeries(input.bars, input.buySellVolume).history
    );
}

/** 메타 설명에 싣는 사실. 점수를 못 내면 `null`(호출부가 템플릿 설명을 유지한다). */
export function buildFearGreedMetaFactsFromBars(
    data: BarsData
): FearGreedMetaFacts | null {
    return buildFearGreedMetaFacts(scoredHistoryFromBars(data));
}

/** 마지막 점수 봉의 날짜 `YYYY-MM-DD`. 점수가 없으면 `undefined`. */
export function lastScoredDateFromBars(data: BarsData): string | undefined {
    return scoredHistoryFromBars(data).at(-1)?.date;
}
