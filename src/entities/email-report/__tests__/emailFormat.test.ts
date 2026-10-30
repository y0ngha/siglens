import {
    formatClose,
    formatDate,
    formatPercent,
    formatSignedPercent,
} from '@/entities/email-report/templates/emailFormat';

describe('formatDate', () => {
    it('발송일을 로케일의 "월 일" 꼴로 쓴다', () => {
        expect(formatDate('2026-10-14', 'ko')).toBe('10월 14일');
        expect(formatDate('2026-10-14', 'en')).toBe('October 14');
    });
});

describe('formatPercent', () => {
    it('이미 퍼센트 단위인 값에 자릿수만 맞춰 %를 붙인다', () => {
        expect(formatPercent(28.456, 1)).toBe('28.5%');
    });
});

describe('formatSignedPercent', () => {
    it.each([
        [1.234, '+1.23%'],
        [0, '0.00%'],
        [-0.5, '-0.50%'],
    ])('%s -> %s', (value, expected) => {
        expect(formatSignedPercent(value)).toBe(expected);
    });
});

describe('formatClose', () => {
    it('천 단위 구분과 소수 둘째 자리까지 쓴다', () => {
        expect(formatClose(1234.5678, 'en')).toBe('1,234.57');
    });
});
