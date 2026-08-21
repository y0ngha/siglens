import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import {
    composeSymbolTitle,
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
    type SeoTranslator,
} from '@/shared/lib/seo';
import {
    SEO_WORST_CASE_KOREAN_NAME,
    SEO_WORST_CASE_TICKER,
} from '@/__tests__/utils/seoTitleFixtures';

// t는 이제 필수 인자다(§design SeoTranslator required-param). ko로 고정한
// 실제 번역자를 한 번 만들어 모든 builder 호출에 재사용한다.
let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

type EquityBuilder = (
    symbol: string,
    t: SeoTranslator,
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

describe('주식 title 템플릿 8개 — 한국어 회사명 주입', () => {
    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 있으면 애플(AAPL)로 시작한다',
        (_name, build) => {
            const { title } = build('AAPL', t, { koreanName: '애플' });
            expect(title.startsWith('애플(AAPL)')).toBe(true);
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 없으면 AAPL로 시작하는 title로 저하되고 undefined를 포함하지 않는다',
        (_name, build) => {
            const { title } = build('AAPL', t);
            expect(title.startsWith('AAPL')).toBe(true);
            expect(title).not.toContain('undefined');
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 애플(AAPL) 케이스는 폭 상한 55를 넘지 않는다',
        (_name, build) => {
            const { title } = build('AAPL', t, { koreanName: '애플' });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 실측 최악 케이스(NVDL)도 폭 상한 55를 넘지 않고 core가 살아남는다',
        (_name, build, core) => {
            const { title } = build(SEO_WORST_CASE_TICKER, t, {
                koreanName: SEO_WORST_CASE_KOREAN_NAME,
            });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
            expect(title).toContain(core);
        }
    );

    it('fear-greed title은 공포 탐욕 지수를 포함한다', () => {
        const { title } = buildSymbolFearGreedSeoContent('AAPL', t, {
            koreanName: '애플',
        });
        expect(title).toContain('공포 탐욕 지수');
    });
});

/**
 * 로케일 회귀.
 *
 * `composeSymbolTitle`은 21개 빌더가 공유한다. 빌더마다 고치면 하나만
 * 빠뜨려도 그 탭만 조용히 한국어 제목으로 남으므로 **여기서 한 번에** 거른다.
 * `/en/AAPL`이 `애플(AAPL) Stock Forecast …`로 나가던 결함이다.
 */
describe('composeSymbolTitle — 로케일', () => {
    const ARGS = {
        ticker: 'AAPL',
        koreanName: '애플',
        core: 'Stock Forecast',
        tail: 'Chart',
    };

    it('ko는 한국어명을 붙인다', () => {
        expect(composeSymbolTitle({ ...ARGS, locale: 'ko' })).toContain('애플');
    });

    it('locale 생략은 기본 로케일과 같다', () => {
        expect(composeSymbolTitle(ARGS)).toContain('애플');
    });

    it.each(['en', 'ja', 'zh'] as const)('%s는 한국어명을 빼다', locale => {
        const title = composeSymbolTitle({ ...ARGS, locale });

        expect(title).not.toContain('애플');
        expect(title).toContain('AAPL');
    });
});
