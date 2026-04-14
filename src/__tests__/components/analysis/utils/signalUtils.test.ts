import {
    resolveStrengthDisplay,
    SIGNAL_STRENGTH_LABEL,
} from '@/components/analysis/utils/signalUtils';
import type { SignalStrength } from '@/domain/types';

describe('resolveStrengthDisplay', () => {
    describe('유효한 SignalStrength 값일 때', () => {
        it.each<[SignalStrength, string]>([
            ['strong', SIGNAL_STRENGTH_LABEL.strong],
            ['moderate', SIGNAL_STRENGTH_LABEL.moderate],
            ['weak', SIGNAL_STRENGTH_LABEL.weak],
        ])(
            '%s → label이 %s인 StrengthDisplay를 반환한다',
            (strength, expectedLabel) => {
                const result = resolveStrengthDisplay(strength);
                expect(result).not.toBeNull();
                expect(result!.label).toBe(expectedLabel);
            }
        );

        it('strong → color에 chart-bullish 클래스를 포함한다', () => {
            const result = resolveStrengthDisplay('strong');
            expect(result!.color).toContain('chart-bullish');
        });

        it('moderate → color에 ui-warning 클래스를 포함한다', () => {
            const result = resolveStrengthDisplay('moderate');
            expect(result!.color).toContain('ui-warning');
        });

        it('weak → color에 secondary 클래스를 포함한다', () => {
            const result = resolveStrengthDisplay('weak');
            expect(result!.color).toContain('secondary');
        });
    });

    describe('strength 데이터가 누락된 경우', () => {
        it('null을 받으면 null을 반환한다', () => {
            expect(resolveStrengthDisplay(null)).toBeNull();
        });

        it('undefined을 받으면 null을 반환한다', () => {
            expect(resolveStrengthDisplay(undefined)).toBeNull();
        });

        it('알 수 없는 문자열을 받으면 null을 반환한다', () => {
            // AI 응답이 예상과 다른 값을 내려보내는 경우를 방어한다
            expect(resolveStrengthDisplay('unknown' as SignalStrength)).toBeNull();
        });
    });
});
