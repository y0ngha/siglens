import { resolveTrendDisplay } from '@/widgets/analysis/utils/trendUtils';
import type { Trend } from '@y0ngha/siglens-core';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

// 카탈로그 키를 그대로 돌려주는 더미 번역자 — `t(key)` 호출 여부와 어떤 키로
// 호출됐는지를 함께 검증한다.
const identityT: EnumLabelTranslator = key => key;

describe('resolveTrendDisplay', () => {
    describe('유효한 Trend 값일 때', () => {
        it.each<[Trend, string]>([
            ['bullish', 'trend.bullish'],
            ['bearish', 'trend.bearish'],
            ['neutral', 'trend.neutral'],
        ])(
            '%s → shared.enumLabel.%s 키로 번역자를 호출한다',
            (trend, expectedKey) => {
                const result = resolveTrendDisplay(trend, identityT);
                expect(result).not.toBeNull();
                expect(result!.label).toBe(expectedKey);
            }
        );

        it('t가 반환한 문자열을 label로 그대로 노출한다', () => {
            const t: EnumLabelTranslator = () => '강세';
            const result = resolveTrendDisplay('bullish', t);
            expect(result!.label).toBe('강세');
        });

        it('bullish → color에 chart-bullish 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('bullish', identityT);
            expect(result!.color).toContain('chart-bullish');
        });

        it('bearish → color에 chart-bearish 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('bearish', identityT);
            expect(result!.color).toContain('chart-bearish');
        });

        it('neutral → bgColor에 secondary 클래스를 포함한다', () => {
            const result = resolveTrendDisplay('neutral', identityT);
            expect(result!.bgColor).toContain('secondary');
        });
    });

    describe('Trend 데이터가 누락된 경우', () => {
        it('null을 받으면 null을 반환한다', () => {
            expect(resolveTrendDisplay(null, identityT)).toBeNull();
        });

        it('undefined을 받으면 null을 반환한다', () => {
            expect(resolveTrendDisplay(undefined, identityT)).toBeNull();
        });

        it('알 수 없는 문자열을 받으면 null을 반환한다', () => {
            // AI 응답이 예상과 다른 값을 내려보내는 경우를 방어한다
            expect(
                resolveTrendDisplay('unknown' as Trend, identityT)
            ).toBeNull();
        });
    });
});
