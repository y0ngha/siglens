import type { SymbolBrief } from '@/entities/email-report/reportModel';
import {
    briefRowCells,
    briefTableHtml,
    briefTableLines,
} from '@/entities/email-report/templates/briefTable';

const t = (key: string, values?: Record<string, string>): string =>
    values ? `${key}(${Object.values(values).join(',')})` : key;
const label = (type: string): string | null => type;

function row(overrides: Partial<SymbolBrief> = {}): {
    brief: SymbolBrief;
    pageUrl: string;
} {
    return {
        brief: {
            symbol: 'MSFT',
            close: 1234.5,
            changePercent: 1.5,
            trend: 'uptrend',
            signals: {
                score: 66,
                bullish: [],
                bearish: [],
                fresh: [],
                pullback: null,
            },
            ...overrides,
        },
        pageUrl: 'https://siglens.io/MSFT',
    };
}

describe('briefRowCells', () => {
    it('종가·등락률·추세·신호를 표시 문자열로 만든다', () => {
        expect(briefRowCells(row(), 'en', t, label)).toEqual({
            close: '1,234.5',
            change: '+1.50%',
            changeColor: '#26a69a',
            trend: 'trendState.uptrend',
            signals: 'signalScore(66)',
        });
    });

    it('하락은 하락 색, 0과 null은 흐린 색', () => {
        expect(
            briefRowCells(row({ changePercent: -2 }), 'en', t, label)
                .changeColor
        ).toBe('#ef5350');
        expect(
            briefRowCells(row({ changePercent: 0 }), 'en', t, label).changeColor
        ).toBe('#94a3b8');
        expect(
            briefRowCells(row({ changePercent: null }), 'en', t, label)
        ).toMatchObject({ change: '', changeColor: '#94a3b8' });
    });

    it('종가·추세가 없으면 대시', () => {
        expect(
            briefRowCells(row({ close: null, trend: null }), 'en', t, label)
        ).toMatchObject({ close: '-', trend: '-' });
    });

    it('신호 요약이 null이면 값 전부를 비우고 데이터 없음만 적는다', () => {
        expect(briefRowCells(row({ signals: null }), 'en', t, label)).toEqual({
            close: '-',
            change: '',
            changeColor: '#94a3b8',
            trend: '-',
            signals: 'briefNoData',
        });
    });
});

describe('briefTableHtml', () => {
    it('행이 없으면 빈 문자열', () => {
        expect(briefTableHtml([], 'en', t, label)).toBe('');
    });

    it('행마다 종목 링크와 셀을 그린다', () => {
        const html = briefTableHtml([row()], 'en', t, label);

        expect(html).toContain('<a href="https://siglens.io/MSFT"');
        expect(html).toContain('1,234.5');
        expect(html).toContain('briefColSignals');
    });
});

describe('briefTableLines', () => {
    it('행이 없으면 빈 배열', () => {
        expect(briefTableLines([], 'en', t, label)).toEqual([]);
    });

    it('제목, 행(링크 줄 포함), 끝 빈 줄 순', () => {
        expect(briefTableLines([row()], 'en', t, label)).toEqual([
            '■ sectionBrief',
            '- MSFT | 1,234.5 +1.50% | trendState.uptrend | signalScore(66)\n  https://siglens.io/MSFT',
            '',
        ]);
    });
});
