import { chartLocalization } from '../../utils/chartLocalization';

describe('chartLocalization', () => {
    it('페이지 로케일을 Intl 로케일로 넘긴다', () => {
        expect(chartLocalization('en').locale).toBe('en-US');
        expect(chartLocalization('ko').locale).toBe('ko-KR');
    });

    it('타임프레임이 없으면 시각 포매터를 넣지 않는다', () => {
        expect(chartLocalization('en')).not.toHaveProperty('timeFormatter');
    });

    it('타임프레임이 있으면 그 단위의 시각 포매터를 넣는다', () => {
        expect(typeof chartLocalization('en', '1Day').timeFormatter).toBe(
            'function'
        );
    });
});
