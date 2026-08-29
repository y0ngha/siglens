import { resolveStrengthDisplay } from '@/widgets/analysis/utils/signalUtils';
import type { SignalStrength } from '@y0ngha/siglens-core';

describe('resolveStrengthDisplay', () => {
    describe('유효한 SignalStrength 값일 때', () => {
        it.each<[SignalStrength, string]>([
            ['strong', 'strong'],
            ['moderate', 'moderate'],
            ['weak', 'weak'],
        ])(
            '%s → label이 %s인 StrengthDisplay를 반환한다',
            (strength, expectedLabel) => {
                const result = resolveStrengthDisplay(strength);
                expect(result).not.toBeNull();
                expect(result!.labelKey).toBe(expectedLabel);
            }
        );

        // 텍스트 색은 `chart-*`가 아니라 `ui-*-text`를 쓴다. `chart-*`는 그래픽용(3:1)이라
        // 라이트에서 인셋 표면 4.23~4.30으로 본문 기준(4.5)을 밑돈다 — 틴트 위만이 아니라
        // 민 배경에서도 그렇다(처음엔 950을 빼고 재서 통과로 잘못 봤다).
        it('strong → color에 ui-success-text 클래스를 쓴다', () => {
            const result = resolveStrengthDisplay('strong');
            expect(result!.color).toContain('ui-success-text');
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
            expect(
                resolveStrengthDisplay('unknown' as SignalStrength)
            ).toBeNull();
        });
    });
});
