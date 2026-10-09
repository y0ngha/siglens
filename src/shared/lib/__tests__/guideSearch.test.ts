import { searchGuide, type GuideSearchable } from '@/shared/lib/guideSearch';

function entry(
    slug: string,
    title: string,
    overrides: Partial<GuideSearchable> = {}
): GuideSearchable {
    return { slug, title, aliases: [], summary: '', ...overrides };
}

describe('searchGuide', () => {
    it('빈 질의는 결과가 없다', () => {
        expect(searchGuide([entry('rsi', 'RSI')], '   ', 5)).toEqual([]);
    });

    it('limit이 0 이하면 결과가 없다', () => {
        expect(searchGuide([entry('rsi', 'RSI')], 'rsi', 0)).toEqual([]);
    });

    it('대소문자를 구분하지 않는다', () => {
        const rsi = entry('rsi', 'RSI');
        expect(searchGuide([rsi], 'rSi', 5)).toEqual([rsi]);
    });

    it('NFD로 입력한 한글도 NFC 제목과 일치한다', () => {
        const target = entry('double-top', '이중천장');
        expect(searchGuide([target], '이중천장'.normalize('NFD'), 5)).toEqual([
            target,
        ]);
    });

    it('다른 이름(aliases)으로도 찾는다', () => {
        const target = entry('double-top', '이중천장', {
            aliases: ['더블 탑'],
        });
        expect(searchGuide([target], '더블 탑', 5)).toEqual([target]);
    });

    it('slug의 하이픈은 띄어쓰기와 같게 본다', () => {
        const target = entry('double-top', '이중천장');
        expect(searchGuide([target], 'double top', 5)).toEqual([target]);
    });

    it('완전 일치 > 접두 > 이름 부분 일치 > 요약 일치 순으로 정렬한다', () => {
        const summaryOnly = entry('a', '가', { summary: 'macd 설명' });
        const nameSubstring = entry('b', '신호 macd 해석');
        const prefix = entry('c', 'macd 히스토그램');
        const exact = entry('d', 'MACD');
        expect(
            searchGuide([summaryOnly, nameSubstring, prefix, exact], 'macd', 10)
        ).toEqual([exact, prefix, nameSubstring, summaryOnly]);
    });

    it('같은 순위에서는 입력 순서를 지킨다', () => {
        const first = entry('a', 'macd 하나');
        const second = entry('b', 'macd 둘');
        expect(searchGuide([first, second], 'macd', 10)).toEqual([
            first,
            second,
        ]);
    });

    it('일치하지 않는 항목은 뺀다', () => {
        expect(searchGuide([entry('rsi', 'RSI')], 'bollinger', 5)).toEqual([]);
    });

    it('limit만큼만 돌려준다', () => {
        const entries = ['a', 'b', 'c'].map(s => entry(s, `macd ${s}`));
        expect(searchGuide(entries, 'macd', 2)).toHaveLength(2);
    });
});
