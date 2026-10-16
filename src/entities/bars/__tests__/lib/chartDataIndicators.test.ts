// @vitest-environment node
import {
    calculateIndicators,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { expectTypeOf } from 'vitest';
import {
    CHART_DATA_ALL_INDICATORS,
    CHART_DATA_INDICATOR_NAMES,
    CHART_DATA_PERIOD_KEYED_INDICATORS,
    CHART_DATA_SNAPSHOT_INDICATORS,
    resolveChartDataIndicators,
    type ChartDataIndicatorName,
} from '../../lib/chartDataIndicators';
import { makeDailyBars } from './chartDataFixtures';

describe('CHART_DATA_INDICATOR_NAMES — core IndicatorResult와 1:1', () => {
    it('타입 수준: core가 지표를 추가하면 여기가 tsc에서 먼저 실패한다', () => {
        // core 키 중 목록에 없는 것이 있으면 `never`가 아니라서 이 단언이 컴파일되지 않는다.
        expectTypeOf<
            Exclude<keyof IndicatorResult, ChartDataIndicatorName>
        >().toEqualTypeOf<never>();
        // 반대 방향: 목록에 core에 없는 이름이 있으면 실패한다.
        expectTypeOf<
            Exclude<ChartDataIndicatorName, keyof IndicatorResult>
        >().toEqualTypeOf<never>();
    });

    it('런타임: 실제 calculateIndicators 결과의 키와 정확히 같다', () => {
        const actual = Object.keys(
            calculateIndicators(makeDailyBars(300))
        ).toSorted();
        expect([...CHART_DATA_INDICATOR_NAMES].toSorted()).toEqual(actual);
    });

    it('이름은 중복이 없고 예약어 all과 겹치지 않는다', () => {
        expect(new Set(CHART_DATA_INDICATOR_NAMES).size).toBe(
            CHART_DATA_INDICATOR_NAMES.length
        );
        expect(CHART_DATA_INDICATOR_NAMES).not.toContain(
            CHART_DATA_ALL_INDICATORS
        );
    });

    it('스냅샷·주기 키 분류는 모두 실제 지표 이름이다', () => {
        const all: readonly string[] = CHART_DATA_INDICATOR_NAMES;
        for (const name of [
            ...CHART_DATA_SNAPSHOT_INDICATORS,
            ...CHART_DATA_PERIOD_KEYED_INDICATORS,
        ])
            expect(all).toContain(name);
    });
});

describe('resolveChartDataIndicators', () => {
    it.each([
        ['생략', undefined],
        ['빈 배열', []],
        ['["all"]', ['all']],
        ['all이 다른 이름과 섞임', ['rsi', 'all']],
    ])('%s는 전부', (_label, requested) => {
        expect(resolveChartDataIndicators(requested)).toEqual(
            CHART_DATA_INDICATOR_NAMES
        );
    });

    it('고른 이름만, 정규 순서로, 중복 없이 돌려준다', () => {
        expect(
            resolveChartDataIndicators(['macd', 'rsi', 'macd', 'ma'])
        ).toEqual(['rsi', 'macd', 'ma']);
    });

    it('배열이 아닌 값은 전부로 본다(스키마 검증이 앞서 걸러 낸다)', () => {
        expect(resolveChartDataIndicators('rsi')).toEqual(
            CHART_DATA_INDICATOR_NAMES
        );
    });

    it('모르는 이름만 있으면 빈 목록이다(조용히 전부로 바꾸지 않는다)', () => {
        expect(resolveChartDataIndicators(['bogus'])).toEqual([]);
    });
});
