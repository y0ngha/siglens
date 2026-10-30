import { extractProse } from '../lib/proseFields';

describe('extractProse', () => {
    it('중첩 객체·배열의 점 경로를 만든다', () => {
        expect(
            extractProse({ a: [{ headlineKo: '제목' }, { headlineKo: '둘' }] })
        ).toEqual([
            { path: 'a.0.headlineKo', text: '제목' },
            { path: 'a.1.headlineKo', text: '둘' },
        ]);
    });

    it('최상위 배열은 접두사 없이 인덱스로 시작한다', () => {
        expect(extractProse([{ summary: '요약' }])).toEqual([
            { path: '0.summary', text: '요약' },
        ]);
    });

    it('산문 키의 문자열 배열은 항목별 경로를 만들고 공백 항목은 건너뛴다', () => {
        expect(
            extractProse({ riskFactorsKo: ['위험', '  ', '', '둘째'] })
        ).toEqual([
            { path: 'riskFactorsKo.0', text: '위험' },
            { path: 'riskFactorsKo.3', text: '둘째' },
        ]);
    });

    it('공백만 있는 산문 문자열은 건너뛴다', () => {
        expect(extractProse({ summary: '   ' })).toEqual([]);
    });

    it('산문 키 아래의 객체로는 내려가지 않는다', () => {
        expect(extractProse({ summary: { ko: '내용' } })).toEqual([]);
    });

    it('접미사 없는 비-산문 키와 `Ko` 단독 키는 무시한다', () => {
        expect(
            extractProse({ Ko: '값', ticker: 'AAPL', trend: 'bullish' })
        ).toEqual([]);
    });
});
