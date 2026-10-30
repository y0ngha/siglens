import { describe, expect, it } from 'vitest';
import {
    describeExtendedMove,
    type ExtendedMoveDisplay,
} from '@/widgets/extended-hours/utils/extendedMove';

describe('describeExtendedMove', () => {
    it('상승은 + 부호·success 색·▲', () => {
        expect(describeExtendedMove(3.42, 0.9972)).toEqual<ExtendedMoveDisplay>(
            {
                direction: 'up',
                amountText: '+$3.42',
                percentText: '+1.00%',
                colorClass: 'text-ui-success-text',
                arrow: '▲',
            }
        );
    });

    it('하락은 크기 앞에 - 부호·danger 색·▼', () => {
        expect(describeExtendedMove(-1.75, -0.5)).toEqual<ExtendedMoveDisplay>({
            direction: 'down',
            amountText: '-$1.75',
            percentText: '-0.50%',
            colorClass: 'text-ui-danger-text',
            arrow: '▼',
        });
    });

    it('등락이 정확히 0이면 보합 — 부호·색·화살표가 없다', () => {
        expect(describeExtendedMove(0, 0)).toEqual<ExtendedMoveDisplay>({
            direction: 'flat',
            amountText: '$0.00',
            percentText: '0.00%',
            colorClass: null,
            arrow: null,
        });
    });

    it('금액·% 모두 0.00으로 반올림되는 미세 하락도 보합이다(-0.00%가 새지 않는다)', () => {
        expect(
            describeExtendedMove(-0.004, -0.0012)
        ).toEqual<ExtendedMoveDisplay>({
            direction: 'flat',
            amountText: '$0.00',
            percentText: '0.00%',
            colorClass: null,
            arrow: null,
        });
    });

    it('부동소수 잡음(1e-13)은 보합이다', () => {
        expect(describeExtendedMove(1e-13, 3e-14).direction).toBe('flat');
    });

    it('금액이 $0.00이어도 %가 보이면 %의 방향을 따른다(상승)', () => {
        expect(describeExtendedMove(0.004, 0.006)).toEqual<ExtendedMoveDisplay>(
            {
                direction: 'up',
                amountText: '+$0.00',
                percentText: '+0.01%',
                colorClass: 'text-ui-success-text',
                arrow: '▲',
            }
        );
    });

    it('금액이 $0.00이어도 %가 보이면 %의 방향을 따른다(하락)', () => {
        expect(
            describeExtendedMove(-0.004, -0.006)
        ).toEqual<ExtendedMoveDisplay>({
            direction: 'down',
            amountText: '-$0.00',
            percentText: '-0.01%',
            colorClass: 'text-ui-danger-text',
            arrow: '▼',
        });
    });

    it('금액이 정확히 0이고 %만 보이면 금액의 0이 아니라 %의 부호로 칠한다', () => {
        expect(describeExtendedMove(0, 0.006)).toEqual<ExtendedMoveDisplay>({
            direction: 'up',
            amountText: '+$0.00',
            percentText: '+0.01%',
            colorClass: 'text-ui-success-text',
            arrow: '▲',
        });
    });

    it('금액이 한 센트라도 보이면 % 가 0.00이어도 그 방향이다', () => {
        expect(
            describeExtendedMove(-0.01, -0.0029)
        ).toEqual<ExtendedMoveDisplay>({
            direction: 'down',
            amountText: '-$0.01',
            percentText: '-0.00%',
            colorClass: 'text-ui-danger-text',
            arrow: '▼',
        });
    });
});
