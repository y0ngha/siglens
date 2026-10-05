import { cache } from 'react';
import {
    computeFearGreedHistory,
    computeFearGreedIndex,
    fearGreedInputs,
    type Bar,
    type BarsData,
    type BuySellVolumeResult,
    type FearGreedHistoryPoint,
    type FearGreedInputs,
    type FearGreedSnapshot,
} from '@y0ngha/siglens-core';

/**
 * 종목 공포·탐욕 점수가 계산되는 **유일한 입구**.
 *
 * core 2.10.0부터 일봉 결과에 5년 일봉(`fearGreedBars`)이 붙고, 점수는 그 5년
 * 기준 백분위다. 헤더 배지·공포탐욕 페이지·색인 게이트·클라이언트 게이지·AI 챗
 * 도구가 **같은 5년 시계열**을 봐야 같은 날 점수가 표면마다 갈리지 않는다. 그래서
 * 입력 고르기(`fearGreedInputs`)와 계산을 여기 한 곳에 둔다. 예외는 AI 챗 도구
 * (`app/api/ai/chat/tools/getBarsIndicators.ts`) 하나다 — 스냅샷만 필요해 history
 * 계산을 피하려고 core `fearGreedInputs` + `computeFearGreedIndex`를 직접 부른다.
 *
 * `React.cache`로 감싼 이유: 한 요청에서 레이아웃(배지)·`generateMetadata`(게이트)·
 * 페이지(요약·시드)가 같은 `BarsData` 객체(`getQuantizedBarsStatic`도 요청 스코프
 * 메모다)로 계산한다. 5년 history 계산은 종목당 100ms대라 같은 계산을 네 번 하지
 * 않게 객체 동일성으로 접는다.
 */
export const symbolFearGreedInputs = cache((data: BarsData): FearGreedInputs =>
    fearGreedInputs(data)
);

export interface SymbolFearGreedSeries {
    readonly snapshot: FearGreedSnapshot | null;
    readonly history: FearGreedHistoryPoint[];
}

/** 같은 입력 배열이면 한 요청 안에서 한 번만 계산한다(`symbolFearGreedInputs` 참고). */
export const computeSymbolFearGreedSeries = cache(
    (
        bars: Bar[],
        buySellVolume: BuySellVolumeResult[]
    ): SymbolFearGreedSeries => ({
        snapshot: computeFearGreedIndex(bars, buySellVolume),
        history: computeFearGreedHistory(bars, buySellVolume),
    })
);

/** `BarsData`에서 바로 스냅샷만 — 헤더 배지·색인 게이트용. */
export function symbolFearGreedSnapshot(
    data: BarsData
): FearGreedSnapshot | null {
    const input = symbolFearGreedInputs(data);
    return computeSymbolFearGreedSeries(input.bars, input.buySellVolume)
        .snapshot;
}

/**
 * 클라이언트 게이지에 보내는 history 길이(약 2년).
 *
 * 5년 전체(약 1,260점)를 보내면 응답이 2.5배가 된다. 클라이언트 위젯은 1년 전 비교
 * (252거래일)와 시계열 차트만 그리므로, 5년 이전의 기준 일봉 길이와 같은 2년이면
 * 화면은 그대로다. 점수 자체는 서버가 5년 기준으로 계산한 값이다.
 */
export const CLIENT_FEAR_GREED_HISTORY_POINTS = 504;

/** 클라이언트로 보내는 형태 — 5년 기준 점수, 최근 2년 history. */
export function clientSymbolFearGreed(data: BarsData): SymbolFearGreedSeries {
    const input = symbolFearGreedInputs(data);
    const { snapshot, history } = computeSymbolFearGreedSeries(
        input.bars,
        input.buySellVolume
    );
    return {
        snapshot,
        history: history.slice(-CLIENT_FEAR_GREED_HISTORY_POINTS),
    };
}
