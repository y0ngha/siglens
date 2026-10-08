import { normalizeCompanyName } from '../../lib/normalizeCompanyName';

describe('normalizeCompanyName — 표기 차이는 같은 이름', () => {
    it.each([
        ['IonQ, Inc.', 'IonQ Inc'],
        ['SEALSQ Corp', 'SEALSQ Corp.'],
        ['Apple Inc.', 'APPLE INC'],
        ['Johnson & Johnson', 'Johnson and Johnson'],
        ['Microsoft Corporation', 'Microsoft Corp'],
        ['Alphabet Inc. Class A', 'Alphabet Inc.'],
        ['Coca-Cola Co', 'Coca Cola Company'],
        [
            'Taiwan Semiconductor Manufacturing Company Ltd.',
            'Taiwan Semiconductor Manufacturing Co',
        ],
        ['Brookfield Holdings Group Inc', 'Brookfield'],
        ['Vodafone Group Plc ADR', 'Vodafone'],
        ['Example Corp Common Stock', 'Example Corp'],
        ['Ａｐｐｌｅ Inc', 'Apple Inc'],
        ['  Spaced   Out  Inc ', 'Spaced Out'],
        ['Icahn Enterprises L.P.', 'Icahn Enterprises'],
    ])('%s ≡ %s', (a, b) => {
        expect(normalizeCompanyName(a)).toBe(normalizeCompanyName(b));
    });
});

describe('normalizeCompanyName — 실제로 다른 회사는 다른 이름', () => {
    it.each([
        ['Apple Inc.', 'Applied Materials Inc.'],
        ['Old Company Holdings', 'Apple Inc.'],
        ['Meta Platforms Inc', 'Facebook Inc'],
        ['Delta Air Lines', 'Delta Apparel'],
        ['Alpha Corp', 'Beta Corp'],
    ])('%s ≠ %s', (a, b) => {
        expect(normalizeCompanyName(a)).not.toBe(normalizeCompanyName(b));
    });
});

describe('normalizeCompanyName — 세부 규칙', () => {
    it('법인격 토큰은 꼬리에서 반복해서 떼어낸다', () => {
        expect(normalizeCompanyName('Foo Holdings Group Inc.')).toBe('foo');
    });

    it('법인격이 이름 중간에 있으면 떼지 않는다', () => {
        expect(normalizeCompanyName('Group Foo Bar')).toBe('group foo bar');
    });

    it('전부 법인격 토큰이면 빈 문자열이 되지 않게 남긴다', () => {
        expect(normalizeCompanyName('Holdings Group')).not.toBe('');
        expect(normalizeCompanyName('Inc.')).toBe('inc');
    });

    it('빈 입력은 빈 문자열', () => {
        expect(normalizeCompanyName('')).toBe('');
    });
});
