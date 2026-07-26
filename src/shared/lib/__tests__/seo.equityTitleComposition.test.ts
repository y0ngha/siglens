import {
    buildSymbolSeoContent,
    buildSymbolFinancialsSeoContent,
    buildSymbolCongressSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolOptionsSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
    buildSymbolFearGreedSeoContent,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
} from '@/shared/lib/seo';

type EquityBuilder = (
    symbol: string,
    opts?: { koreanName?: string; displayName?: string }
) => { title: string };

const EQUITY_BUILDERS: readonly (readonly [string, EquityBuilder, string])[] = [
    ['chart', buildSymbolSeoContent, '주가 전망'],
    ['financials', buildSymbolFinancialsSeoContent, '재무제표'],
    ['congress', buildSymbolCongressSeoContent, '의회 거래'],
    ['fundamental', buildSymbolFundamentalSeoContent, '펀더멘털'],
    ['options', buildSymbolOptionsSeoContent, '옵션 분석'],
    ['news', buildSymbolNewsSeoContent, '뉴스'],
    ['overall', buildSymbolOverallSeoContent, '종합 분석'],
    ['fear-greed', buildSymbolFearGreedSeoContent, '공포 탐욕 지수'],
];

// 264개 화이트리스트 중 실측 최대 폭 종목 — 레버리지 ETF라 한국어명이 서술적이고
// 검색어는 티커 자체다(composeSymbolTitle의 3단 강등 문서 참고).
const WORST_CASE_KOREAN_NAME = '그래닛셰어스 2배 레버리지 NVDA 데일리 ETF';
const WORST_CASE_TICKER = 'NVDL';

describe('주식 title 템플릿 8개 — 한국어 회사명 주입', () => {
    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 있으면 애플(AAPL)로 시작한다',
        (_name, build) => {
            const { title } = build('AAPL', { koreanName: '애플' });
            expect(title.startsWith('애플(AAPL)')).toBe(true);
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 없으면 AAPL로 시작하는 title로 저하되고 undefined를 포함하지 않는다',
        (_name, build) => {
            const { title } = build('AAPL');
            expect(title.startsWith('AAPL')).toBe(true);
            expect(title).not.toContain('undefined');
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 애플(AAPL) 케이스는 폭 상한 55를 넘지 않는다',
        (_name, build) => {
            const { title } = build('AAPL', { koreanName: '애플' });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 실측 최악 케이스(NVDL)도 폭 상한 55를 넘지 않고 core가 살아남는다',
        (_name, build, core) => {
            const { title } = build(WORST_CASE_TICKER, {
                koreanName: WORST_CASE_KOREAN_NAME,
            });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
            expect(title).toContain(core);
        }
    );

    it('fear-greed title은 공포 탐욕 지수를 포함한다', () => {
        const { title } = buildSymbolFearGreedSeoContent('AAPL', {
            koreanName: '애플',
        });
        expect(title).toContain('공포 탐욕 지수');
    });
});
