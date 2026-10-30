import { formatDecimal } from '@/widgets/fundamental/utils/decimalFormat';

describe('formatDecimal', () => {
    it('최대 자릿수까지만 로케일 표기한다', () => {
        expect(formatDecimal(1234.5678, 1, 'en')).toBe('1,234.6');
        expect(formatDecimal(3, 2, 'en')).toBe('3');
    });
});
