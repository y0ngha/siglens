import type { GuideEntry } from '@/entities/guide/types';
import {
    countByCategory,
    filterGuideEntries,
    GUIDE_FILTER_ALL,
    GUIDE_QUERY_MAX_LENGTH,
    groupGuideByCategory,
    guideNeighbors,
    parseGuideBrowseState,
    parseGuideCategory,
    resolveRelated,
    toGuideSearchString,
    toGuideSummary,
} from '../guideBrowse';

function entry(overrides: Partial<GuideEntry> & { slug: string }): GuideEntry {
    return {
        category: 'indicators',
        order: 1,
        title: overrides.slug,
        aliases: [],
        summary: '',
        updatedAt: '2026-10-10T00:00:00.000Z',
        seoTitle: '',
        seoDescription: '',
        demoCaption: null,
        bodyMd: '본문',
        faq: [],
        related: [],
        isFallback: false,
        ...overrides,
    };
}

const DOJI = entry({
    slug: 'doji',
    category: 'candlesticks',
    title: '도지',
    aliases: ['십자형'],
    summary: '시가와 종가가 거의 같은 캔들이에요.',
});
const HAMMER = entry({
    slug: 'hammer',
    category: 'candlesticks',
    title: '망치형',
    summary: '긴 아래꼬리가 달린 캔들이에요.',
});
const RSI = entry({
    slug: 'rsi',
    title: 'RSI',
    aliases: ['상대강도지수'],
    summary: '과열과 과매도를 가늠하는 지표예요.',
    related: ['macd', 'rsi', 'missing'],
});
const MACD = entry({
    slug: 'macd',
    title: 'MACD',
    summary: '이동평균의 차이.',
});
const ALL = [DOJI, HAMMER, RSI, MACD];

describe('parseGuideCategory', () => {
    it('알려진 분류만 통과시킨다', () => {
        expect(parseGuideCategory('indicators')).toBe('indicators');
        expect(parseGuideCategory('nope')).toBeNull();
        expect(parseGuideCategory(null)).toBeNull();
    });
});

describe('parseGuideBrowseState', () => {
    it('빈 URL은 질의 없음·전체다', () => {
        expect(parseGuideBrowseState(null, null)).toEqual({
            query: '',
            category: GUIDE_FILTER_ALL,
        });
    });

    it('알 수 없는 분류는 전체로 되돌린다', () => {
        expect(parseGuideBrowseState('rsi', 'bogus').category).toBe(
            GUIDE_FILTER_ALL
        );
    });

    it('질의 길이를 상한에서 자른다', () => {
        const long = 'a'.repeat(GUIDE_QUERY_MAX_LENGTH + 40);
        expect(parseGuideBrowseState(long, null).query).toHaveLength(
            GUIDE_QUERY_MAX_LENGTH
        );
    });
});

describe('toGuideSearchString', () => {
    it('기본값은 쿼리스트링에 싣지 않는다', () => {
        expect(
            toGuideSearchString({ query: '  ', category: GUIDE_FILTER_ALL })
        ).toBe('');
    });

    it('질의와 분류를 함께 싣고 파서와 왕복한다', () => {
        const search = toGuideSearchString({
            query: '이중 바닥',
            category: 'chart-patterns',
        });
        const params = new URLSearchParams(search);
        expect(parseGuideBrowseState(params.get('q'), params.get('c'))).toEqual(
            {
                query: '이중 바닥',
                category: 'chart-patterns',
            }
        );
    });
});

describe('filterGuideEntries', () => {
    it('필터가 없으면 카탈로그 순서 그대로다', () => {
        expect(
            filterGuideEntries(ALL, { query: '', category: GUIDE_FILTER_ALL })
        ).toEqual(ALL);
    });

    it('분류로 거른다', () => {
        expect(
            filterGuideEntries(ALL, { query: '', category: 'candlesticks' })
        ).toEqual([DOJI, HAMMER]);
    });

    it('다른 이름으로도 찾는다', () => {
        expect(
            filterGuideEntries(ALL, {
                query: '상대강도',
                category: GUIDE_FILTER_ALL,
            })
        ).toEqual([RSI]);
    });

    it('분류와 질의를 함께 건다', () => {
        expect(
            filterGuideEntries(ALL, { query: 'rsi', category: 'candlesticks' })
        ).toEqual([]);
    });
});

describe('groupGuideByCategory', () => {
    it('분류 순서대로 묶고 빈 분류는 뺀다', () => {
        const groups = groupGuideByCategory(ALL);
        expect(groups.map(g => g.category)).toEqual([
            'candlesticks',
            'indicators',
        ]);
        expect(groups[0]?.entries).toEqual([DOJI, HAMMER]);
    });
});

describe('countByCategory', () => {
    it('분류별 개수를 센다', () => {
        expect(countByCategory(ALL)).toEqual({
            candlesticks: 2,
            'chart-patterns': 0,
            indicators: 2,
            strategies: 0,
        });
    });
});

describe('guideNeighbors', () => {
    it('같은 분류 안의 앞뒤를 돌려주고 끝은 null이다', () => {
        expect(guideNeighbors(ALL, DOJI)).toEqual({
            previous: null,
            next: HAMMER,
        });
        expect(guideNeighbors(ALL, MACD)).toEqual({
            previous: RSI,
            next: null,
        });
    });

    it('카탈로그에 없는 항목은 앞뒤가 없다', () => {
        expect(guideNeighbors(ALL, entry({ slug: 'ghost' }))).toEqual({
            previous: null,
            next: null,
        });
    });
});

describe('resolveRelated', () => {
    it('없는 slug와 자기 자신을 빼고 적힌 순서를 지킨다', () => {
        expect(resolveRelated(ALL, RSI)).toEqual([MACD]);
    });
});

describe('toGuideSummary', () => {
    it('본문·FAQ 같은 무거운 필드를 떼어 낸다', () => {
        const summary = toGuideSummary(RSI);
        expect(summary).not.toHaveProperty('bodyMd');
        expect(summary).not.toHaveProperty('faq');
        expect(summary.title).toBe('RSI');
    });
});
