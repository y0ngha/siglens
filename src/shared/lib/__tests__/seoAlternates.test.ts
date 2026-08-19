import {
    buildLanguageAlternates,
    localeAlternates,
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
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
    it('현재 로케일과 나머지를 배타적으로 나눈다', () => {
        expect(localeOpenGraph('ja')).toEqual({
            locale: 'ja_JP',
            alternateLocale: ['ko_KR', 'en_US', 'zh_CN'],
        });
    });
});
