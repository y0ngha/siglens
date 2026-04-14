import { resolveTrendDisplay } from '@/components/analysis/utils/trendUtils';
import type { Trend } from '@/domain/types';

describe('resolveTrendDisplay', () => {
    describe('유효한 Trend 값일 때', () => {
        it.each<[Trend, string]>([
            ['bullish', '강세'],
            ['bearish', '약세'],
            ['neutral', '보합'],
        ])(
            '%s → label이 %s인 TrendDisplay를 반환한다',
            (trend, expectedLabel) => {
                const result = resolveTrendDisplay(trend);
                expect(result).not.toBeNull();
                expect(result!.label).toBe(expectedLabel);
            }
        );

        it('bullish → color에 chart-bullish 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('bullish');
            expect(result!.color).toContain('chart-bullish');
        });

        it('bearish → color에 chart-bearish 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('bearish');
            expect(result!.color).toContain('chart-bearish');
        });

        it('neutral → bgColor에 secondary 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('neutral');
            expect(result!.bgColor).toContain('secondary');
        });
    });

    describe('Trend 데이터가 누락된 경우', () => {
        it('null을 받으면 null을 반환한다', () => {
            expect(resolveTrendDisplay(null)).toBeNull();
        });

        it('undefined을 받으면 null을 반환한다', () => {
            expect(resolveTrendDisplay(undefined)).toBeNull();
        });

        it('알 수 없는 문자열을 받으면 null을 반환한다', () => {
            // AI 응답이 예상과 다른 값을 내려보내는 경우를 방어한다
            expect(resolveTrendDisplay('unknown' as Trend)).toBeNull();
        });
    });
});
