import {
    buildLanguageAlternates,
    localeAlternates,
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localePageRobots,
    selfCanonicalAlternates,
} from '../seoAlternates';
import { SITE_URL } from '../seo';
import { LOCALES } from '@/shared/i18n/locales';

describe('buildLanguageAlternates', () => {
    /**
     * hreflang은 **상호 참조**여야 Google이 묶음을 인정한다. 한 로케일이라도 빠지면
     * 전체가 무시되고 각 URL이 독립 중복 콘텐츠가 된다.
     */
    it('전 로케일 + x-default를 선언한다', () => {
        expect(buildLanguageAlternates('/AAPL', LOCALES)).toEqual({
            ko: `${SITE_URL}/AAPL`,
            en: `${SITE_URL}/en/AAPL`,
            ja: `${SITE_URL}/ja/AAPL`,
            'zh-Hans': `${SITE_URL}/zh/AAPL`,
            'x-default': `${SITE_URL}/AAPL`,
        });
    });

    /** 미번역 로케일을 광고하면 thin content로 색인돼 2026-07 노출 붕괴가 재현된다. */
    it('준비되지 않은 로케일은 제외한다', () => {
        expect(
            Object.keys(buildLanguageAlternates('/AAPL', ['ko', 'en']))
        ).toEqual(['ko', 'en', 'x-default']);
    });

    /**
     * 자기 자신만 가리키는 hreflang은 정보가 0인데 색인된 전 페이지의 HTML을
     * 바꾼다. 두 번째 로케일이 준비되는 순간 한꺼번에 나가야 한다.
     */
    it('준비된 로케일이 하나뿐이면 아무것도 선언하지 않는다', () => {
        expect(buildLanguageAlternates('/AAPL', ['ko'])).toEqual({});
    });
});

/**
 * 준비 집합에 자기가 없으면 hreflang을 달지 않는다. 자기를 뺀 클러스터는
 * 상호 참조가 깨져 Google이 통째로 버리고, 그 URL은 self-canonical만 남은 채
 * 중복 후보가 된다. `STATIC_INDEXABLE_LOCALES`에 두 번째 로케일을 넣는
 * 순간에만 드러나는 결함이라 가드가 없으면 그때 가서 터진다.
 */
describe('localeAlternates — 준비되지 않은 로케일', () => {
    it('available에 자기가 없으면 languages를 달지 않는다', () => {
        const result = localeAlternates('ja', '/news', {
            available: ['ko', 'en'],
        });
        expect(result.canonical).toBe('https://siglens.io/ja/news');
        expect(result.languages).toBeUndefined();
    });

    it('available에 자기가 있으면 전체 클러스터를 단다', () => {
        const result = localeAlternates('en', '/news', {
            available: ['ko', 'en'],
        });
        expect(result.languages).toEqual({
            ko: 'https://siglens.io/news',
            en: 'https://siglens.io/en/news',
            'x-default': 'https://siglens.io/news',
        });
    });
});

describe('localeAlternates', () => {
    it('준비 로케일이 여럿이면 languages를 함께 낸다', () => {
        const result = localeAlternates('en', '/news', {
            available: ['ko', 'en'],
        });
        expect(Object.keys(result.languages ?? {})).toEqual([
            'ko',
            'en',
            'x-default',
        ]);
    });

    it('준비 로케일이 하나면 languages 키 자체를 내지 않는다', () => {
        expect(localeAlternates('ko', '/news', { available: ['ko'] })).toEqual({
            canonical: `${SITE_URL}/news`,
        });
    });

    it('자기참조 canonical을 기본값으로 쓴다 — hreflang 성립 조건', () => {
        expect(localeAlternates('ja', '/news').canonical).toBe(
            `${SITE_URL}/ja/news`
        );
        expect(localeCanonical('ja', '/news')).toBe(`${SITE_URL}/ja/news`);
    });

    /** 색인되지 않는 URL을 대체 언어로 광고하면 크롤 예산만 태운다. */
    it('canonical이 null이면 hreflang을 붙이지 않는다', () => {
        expect(localeAlternates('en', '/market', { canonical: null })).toEqual({
            canonical: null,
        });
    });

    it('명시된 canonical을 그대로 존중한다', () => {
        expect(
            localeAlternates('en', '/market', { canonical: '/custom' })
                .canonical
        ).toBe('/custom');
    });
});

describe('localeAlternates — 발견 링크(types)', () => {
    const TYPES = { 'application/rss+xml': `${SITE_URL}/rss.xml` };

    it('옵션으로 준 types를 canonical·languages와 함께 낸다', () => {
        expect(
            localeAlternates('ko', '/', { available: ['ko'], types: TYPES })
        ).toEqual({ canonical: `${SITE_URL}/`, types: TYPES });
        const multi = localeAlternates('ko', '/', {
            available: ['ko', 'en'],
            types: TYPES,
        });
        expect(multi.types).toEqual(TYPES);
        expect(multi.languages).toBeDefined();
    });

    it('준비 집합에 없는 로케일에도 types는 유지한다 — 발견 링크는 hreflang 클러스터와 무관하다', () => {
        expect(
            localeAlternates('en', '/', { available: ['ko'], types: TYPES })
                .types
        ).toEqual(TYPES);
    });

    it('옵션이 없으면 types 키 자체를 내지 않는다 — 기존 페이지 head가 바뀌지 않는다', () => {
        expect('types' in localeAlternates('ko', '/news')).toBe(false);
    });

    it('canonical이 null인 noindex 분기에는 붙이지 않는다', () => {
        expect(
            localeAlternates('ko', '/', { canonical: null, types: TYPES })
        ).toEqual({ canonical: null });
    });
});

describe('localeAlternatesFrom', () => {
    it('params에서 로케일을 읽는다', async () => {
        const result = await localeAlternatesFrom(
            Promise.resolve({ locale: 'zh' }),
            '/economy'
        );
        expect(result.canonical).toBe(`${SITE_URL}/zh/economy`);
    });

    /** 메타데이터 생성 실패는 5xx가 된다. 봇에게 5xx는 404보다 나쁘다. */
    it('잘못된 로케일은 던지지 않고 기본 로케일로 떨어진다', async () => {
        const result = await localeAlternatesFrom(
            Promise.resolve({ locale: 'unknown.txt' }),
            '/economy'
        );
        expect(result.canonical).toBe(`${SITE_URL}/economy`);
    });
});

describe('localeOpenGraph', () => {
    it('색인 가능 로케일이 하나뿐이면 대체본을 광고하지 않는다', () => {
        // hreflang과 같은 게이트다 — `buildLanguageAlternates`도 `available`이
        // 2개 미만이면 `{}`를 돌려준다. 클러스터가 성립하지 않는데 한쪽만
        // 광고하면 신호가 어긋난다.
        expect(localeOpenGraph('ja')).toEqual({
            locale: 'ja_JP',
            alternateLocale: [],
        });
    });

    it('게이트가 열리면 자기 자신을 뺀 나머지를 나열한다', () => {
        expect(localeOpenGraph('ja', ['ko', 'en', 'ja', 'zh'])).toEqual({
            locale: 'ja_JP',
            alternateLocale: ['ko_KR', 'en_US', 'zh_CN'],
        });
    });
});

/**
 * Next는 `robots`를 부모와 병합하지 않고 교체한다. 페이지가 이 값을 쓰면 레이아웃의
 * 미리보기 지시가 사라지지 않아야 하고, noindex 로케일에서 `googleBot`이 색인을
 * 뒤집어서도 안 된다.
 */
describe('localePageRobots', () => {
    it('색인 로케일은 색인 지시와 구글 미리보기 지시를 함께 낸다', () => {
        expect(localePageRobots('ko')).toEqual({
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        });
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s는 noindex이고 googleBot도 noindex를 따른다',
        locale => {
            const robots = localePageRobots(locale) as {
                index: boolean;
                googleBot: { index: boolean };
            };
            expect(robots.index).toBe(false);
            expect(robots.googleBot.index).toBe(false);
        }
    );

    it('base가 noindex면 색인 로케일이어도 noindex다', () => {
        const robots = localePageRobots('ko', {
            index: false,
            follow: true,
        }) as { index: boolean; googleBot: { index: boolean } };
        expect(robots.index).toBe(false);
        expect(robots.googleBot.index).toBe(false);
    });
});

describe('selfCanonicalAlternates', () => {
    /**
     * noindex 렌더(degraded 허브·빌드 fallback 약관)의 alternates. `canonical: null`은 신호를
     * 비워 크롤러가 군집을 추정하게 두므로 자기 URL을 가리키되, 색인되지 않는 URL을 대체
     * 언어로 광고하지는 않는다.
     */
    it('로케일 접두사가 붙은 자기 URL만 canonical로 내고 languages·types는 없다', () => {
        expect(selfCanonicalAlternates('ko', '/market')).toEqual({
            canonical: `${SITE_URL}/market`,
        });
        expect(selfCanonicalAlternates('en', '/news/us')).toEqual({
            canonical: `${SITE_URL}/en/news/us`,
        });
    });
});
