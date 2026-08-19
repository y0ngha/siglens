/**
 * 시리즈 정렬 **통합** 테스트 — `seriesDataUtils`를 mock하지 않는다.
 *
 * ## 왜 필요한가
 *
 * 차트 훅 테스트 32개가 전부 `vi.mock('../../utils/seriesDataUtils')`로 빌더를 가린다.
 * 그래서 `seriesDataUtils.test.ts`의 유닛 테스트가 **유일한 방어선**이고, 훅이 빌더를
 * 잘못 호출하거나 정렬 규약이 깨져도 아무 테스트도 빨개지지 않는다.
 *
 * 이 파일은 그 구멍을 메운다: core가 실제로 만든 지표를 RSC seed와 같은 방식으로 접은 뒤,
 * **진짜 빌더**에 통과시켜 결과 좌표를 단언한다. seed 접기(`getSeedBarsStatic`)와 tail
 * 정렬(`seriesDataUtils`)은 커플링돼 있어서 — 한쪽만 되돌리면 값이 엉뚱한 날짜에 찍힌다 —
 * 그 커플링을 실물로 고정하는 게 목적이다.
 */
import { describe, it, expect } from 'vitest';
import { calculateIndicators, type Bar } from '@y0ngha/siglens-core';
import {
    buildSeriesData,
    buildSeriesDataFromValues,
} from '@/widgets/chart/utils/seriesDataUtils';
// 재구현하지 말 것. 이 파일의 목적이 "seed 접기와 tail 정렬의 커플링을 실물로 고정"하는
// 것인데, 접기 규칙을 복사해 두면 `barsStaticCache` 쪽을 되돌려도 초록으로 남는다
// (2026-08 감사가 지적). 진짜 함수를 가져온다.
import { keepLastNonNull } from '@/entities/bars/lib/barsStaticCache';

/** 지표 워밍업(RSI 14, MACD 26+9)을 넘기기에 충분한 결정적 봉 시리즈. */
function makeBars(n: number): Bar[] {
    return Array.from({ length: n }, (_, i) => ({
        time: 1_700_000_000 + i * 86_400,
        open: 100 + (i % 7),
        high: 103 + (i % 7),
        low: 98 + (i % 7),
        close: 100 + (i % 11),
        volume: 1000 + i,
    }));
}

describe('시리즈 정렬 통합 — 실제 빌더 + core 실제 지표', () => {
    const bars = makeBars(501);
    const indicators = calculateIndicators(bars);

    it('core가 만든 지표는 봉과 길이가 같다 (tail 정렬이 무동작인 전제)', () => {
        // 이 전제가 깨지면 좌·우 정렬이 서로 다른 결과를 내기 시작한다.
        expect(indicators.rsi).toHaveLength(bars.length);
        expect(indicators.macd).toHaveLength(bars.length);
        expect(indicators.buySellVolume).toHaveLength(bars.length);
    });

    it('길이가 같으면 모든 봉에 점이 찍히고 마지막 값이 마지막 봉에 온다', () => {
        const out = buildSeriesDataFromValues(bars, indicators.rsi);

        expect(out).toHaveLength(bars.length);
        expect(out[0].time).toBe(bars[0].time);
        expect(out.at(-1)?.time).toBe(bars.at(-1)?.time);
    });

    it('seed처럼 접힌 rsi는 **마지막 봉**에 찍힌다 (좌측 정렬이면 501봉 전 자리)', () => {
        const folded = keepLastNonNull(indicators.rsi, v => v !== null);
        const out = buildSeriesDataFromValues(bars, folded);

        expect(folded.length).toBeLessThan(bars.length);
        expect(out).toHaveLength(folded.length);
        // 값이 시계열의 끝에 붙어야 한다 — 이게 이 PR의 핵심 불변식이다.
        expect(out.at(-1)?.time).toBe(bars.at(-1)?.time);
        expect(out.at(-1)).toHaveProperty('value', folded.at(-1));
        // 좌측 정렬이었다면 가장 오래된 봉에 찍혔다.
        expect(out[0].time).not.toBe(bars[0].time);
    });

    it('seed처럼 접힌 macd도 동일하게 마지막 봉 기준이다', () => {
        const folded = keepLastNonNull(
            indicators.macd,
            m => m.histogram !== null
        );
        const out = buildSeriesData(bars, folded, 'histogram');

        expect(out.at(-1)?.time).toBe(bars.at(-1)?.time);
        expect(out).toHaveLength(folded.length);
    });

    it('빈 지표는 점을 하나도 만들지 않는다 (slice(-0) 함정)', () => {
        expect(buildSeriesDataFromValues(bars, [])).toEqual([]);
        expect(buildSeriesData(bars, [], 'histogram' as never)).toEqual([]);
    });
});
