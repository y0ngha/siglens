import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import {
    buildCryptoSymbolSeoContent,
    buildCryptoSymbolNewsSeoContent,
    buildCryptoSymbolOverallSeoContent,
    buildCryptoSymbolFearGreedSeoContent,
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

type CryptoBuilder = (
    symbol: string,
    t: SeoTranslator,
    opts?: { koreanName?: string; displayName?: string }
) => { title: string };

const CRYPTO_BUILDERS: readonly (readonly [string, CryptoBuilder, string])[] = [
    ['chart', buildCryptoSymbolSeoContent, '시세 전망'],
    ['news', buildCryptoSymbolNewsSeoContent, '코인 뉴스'],
    ['overall', buildCryptoSymbolOverallSeoContent, '코인 종합 분석'],
    ['fear-greed', buildCryptoSymbolFearGreedSeoContent, '공포 탐욕 지수'],
];

describe('크립토 title 템플릿 4개 — 주식과 동일한 조합 형태로 통일', () => {
    it.each(CRYPTO_BUILDERS)(
        '%s: 한국어명이 있으면 비트코인(BTCUSD)로 시작한다',
        (_name, build) => {
            const { title } = build('BTCUSD', t, { koreanName: '비트코인' });
            expect(title.startsWith('비트코인(BTCUSD)')).toBe(true);
        }
    );

    it.each(CRYPTO_BUILDERS)(
        '%s: 한국어명이 없으면 BTCUSD로 시작하는 title로 저하되고 undefined를 포함하지 않는다',
        (_name, build) => {
            const { title } = build('BTCUSD', t);
            expect(title.startsWith('BTCUSD')).toBe(true);
            expect(title).not.toContain('undefined');
        }
    );

    it.each(CRYPTO_BUILDERS)(
        '%s: 비트코인(BTCUSD) 케이스는 폭 상한 55를 넘지 않는다',
        (_name, build) => {
            const { title } = build('BTCUSD', t, { koreanName: '비트코인' });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
        }
    );

    it.each(CRYPTO_BUILDERS)(
        // 주식과 동일한 실측 최대 폭 fixture(SEO_WORST_CASE_*)를 재사용한다 —
        // 크립토 화이트리스트에도 서술적인 긴 한국어명(예: 래핑/스테이킹 파생
        // 토큰)이 존재할 수 있어 주식과 동일한 강등 경로를 검증한다.
        '%s: 실측 최악 케이스도 폭 상한 55를 넘지 않고 core가 살아남는다',
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
        const { title } = buildCryptoSymbolFearGreedSeoContent('BTCUSD', t, {
            koreanName: '비트코인',
        });
        expect(title).toContain('공포 탐욕 지수');
    });

    it('크립토 차트 title은 더 이상 displayName 전체(Bitcoin USD)를 보간하지 않는다 (구 누수 회귀 방지)', () => {
        // 이전 구현: `${ticker} 시세 분석 — ${displayName} 차트와 매매 신호` —
        // displayName이 길면 64 폭단위까지 오버플로우했다. composeSymbolTitle은
        // ticker/koreanName만 조합하므로 displayName은 title에 등장하지 않는다.
        const { title } = buildCryptoSymbolSeoContent('BTCUSD', t, {
            displayName: 'Bitcoin USD',
        });
        expect(title).not.toContain('Bitcoin USD');
    });
});
