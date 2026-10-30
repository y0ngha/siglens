import { describe, expect, it } from 'vitest';
import { AXIS_LABEL_KEY } from '@/entities/seo-snapshot/lib/financialsContent';
import koMessages from '../../../../../messages/ko.json';
import {
    SCORECARD_AXES,
    axisLabelKey,
} from '@/widgets/financials/utils/axisLabels';

describe('axisLabels', () => {
    it('스코어카드는 네 축을 정해진 순서로 그린다', () => {
        expect(SCORECARD_AXES).toEqual([
            'growth',
            'quality',
            'solvency',
            'cash',
        ]);
    });

    it('SSR 프로즈와 같은 축 키 정의를 쓴다', () => {
        SCORECARD_AXES.forEach(axis => {
            expect(axisLabelKey(axis)).toBe(AXIS_LABEL_KEY[axis]);
        });
    });

    it('모든 축 키가 shared.enumLabel 카탈로그에 있다', () => {
        SCORECARD_AXES.forEach(axis => {
            const [group, leaf] = axisLabelKey(axis).split('.');
            const enumLabel = koMessages.shared.enumLabel as Record<
                string,
                Record<string, string>
            >;
            expect(enumLabel[group][leaf]).toBeTruthy();
        });
    });
});
