import { parseReportSymbolInput } from '@/entities/email-report/lib/parseReportSymbolInput';

describe('parseReportSymbolInput', () => {
    it('공백을 제거하고 대문자로 정규화한다', () => {
        expect(parseReportSymbolInput({ symbol: ' aapl ' })).toEqual({
            ok: true,
            symbol: 'AAPL',
        });
    });

    it.each([
        ['null', null],
        ['객체가 아님', 'AAPL'],
        ['symbol 누락', {}],
        ['symbol이 숫자', { symbol: 1 }],
        ['빈 문자열', { symbol: '  ' }],
        ['허용되지 않는 형상', { symbol: 'A B/C;' }],
    ])('잘못된 입력(%s)은 ok:false', (_, input) => {
        expect(parseReportSymbolInput(input)).toEqual({ ok: false });
    });
});
