import type { Bar } from '@y0ngha/siglens-core';

/**
 * 가격대(band)별 최근 거래량 비중(%) — PositionBuilding 층 hover에 쓰이는 순수
 * 집계다. positionGeometry.ts와 동일하게 도메인/시그널 의미 없음(scope fence):
 * "이 구간에서 거래량이 얼마나 났는가"만 답하는 raw 히스토그램이고, 매수/매도
 * 압력이나 지지/저항 같은 해석은 담지 않는다.
 *
 * 대표가로 종가(close)를 쓴다: 봉 내 거래가 정확히 어느 가격에서 일어났는지는
 * OHLC 4값만으론 알 수 없어(인트라바 배분은 가정/보간이 필요한 "해석"이라
 * scope fence에 걸린다) 결정적이고 해석 없는 단일 대표값이 필요하다. close는
 * `buildTechnicalFacts`(technicalFacts.ts)가 lastClose를 대표값으로 쓰는
 * 관례와도 일치한다.
 *
 * [low, high]를 bandCount개의 동일 폭 구간으로 나누고, 각 구간에 속한 봉들의
 * volume 합을 전체 volume 대비 %로 반환한다. 반환 배열 인덱스 0 = 최저가
 * 구간(low에 가장 가까운 밴드) — positionGeometry의 BANDS/PositionBuilding의
 * 층 순서(low→high)와 동일하다.
 *
 * 경계 처리: band i는 [low + i*width, low + (i+1)*width)로 inclusive-low/
 * exclusive-high다(positionGeometry의 avgPos===0.2 경계 컨벤션과 동일). 다만
 * close === high(마지막 밴드의 상한)는 clamp로 마지막 밴드에 결정적으로
 * 남긴다 — 그렇지 않으면 인덱스가 bandCount로 밴드 배열을 벗어난다.
 *
 * 가드: bars가 비었거나, low/high가 non-finite/역전(high<=low)이거나,
 * bandCount가 유효한 양의 정수가 아니거나, 전체 거래량이 0/non-finite면
 * null을 반환한다 — 호출부는 volume 라인을 그냥 생략해야 한다.
 */
export function computeVolumeByBand(
    bars: readonly Bar[],
    low: number,
    high: number,
    bandCount: number
): number[] | null {
    if (bars.length === 0) return null;
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    if (high <= low) return null;
    if (!Number.isInteger(bandCount) || bandCount <= 0) return null;

    const bandWidth = (high - low) / bandCount;
    const volumeByBand = new Array<number>(bandCount).fill(0);
    let totalVolume = 0;

    for (const bar of bars) {
        const { close, volume } = bar;
        if (
            !Number.isFinite(close) ||
            !Number.isFinite(volume) ||
            volume <= 0
        ) {
            continue;
        }
        const rawIndex = Math.floor((close - low) / bandWidth);
        const index = Math.min(Math.max(rawIndex, 0), bandCount - 1);
        volumeByBand[index] += volume;
        totalVolume += volume;
    }

    if (!Number.isFinite(totalVolume) || totalVolume <= 0) return null;

    return volumeByBand.map(v => (v / totalVolume) * 100);
}
