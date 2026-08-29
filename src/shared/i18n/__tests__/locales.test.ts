import {
    DEFAULT_LOCALE,
    isLocale,
    LOCALES,
    LOCALE_HREFLANG,
    LOCALE_NATIVE_LABEL,
    LOCALE_OG,
    localePath,
    resolvePrerenderLocales,
    splitLocalePath,
} from '../locales';

describe('localePath', () => {
    it('기본 로케일은 접두사를 붙이지 않는다 — 기존 색인 URL이 그대로여야 한다', () => {
        expect(localePath('ko', '/AAPL')).toBe('/AAPL');
        expect(localePath('ko', '/')).toBe('/');
    });

    it('비-기본 로케일은 접두사를 붙인다', () => {
        expect(localePath('en', '/AAPL')).toBe('/en/AAPL');
        expect(localePath('ja', '/')).toBe('/ja');
    });
});

describe('splitLocalePath', () => {
    it.each([
        ['/AAPL', 'ko', '/AAPL'],
        ['/en/AAPL', 'en', '/AAPL'],
        ['/ja', 'ja', '/'],
        ['/', 'ko', '/'],
        ['/news/us', 'ko', '/news/us'],
    ])('%s → %s %s', (input, locale, path) => {
        expect(splitLocalePath(input)).toEqual({ locale, path });
    });

    /**
     * `/ko/...`도 접두사를 뗀다. 떼지 않으면 프록시의 티커 정규화가 첫 세그먼트
     * `ko`를 심볼로 보고 `/KO`(코카콜라)로 301한다 — 실존 티커라 404도 안 난다.
     */
    it('기본 로케일 접두사도 떼어낸다', () => {
        expect(splitLocalePath('/ko/AAPL')).toEqual({
            locale: 'ko',
            path: '/AAPL',
        });
    });

    /** `usePathname()`은 라우터 컨텍스트 밖에서 null이다. 던지면 헤더가 통째로 죽는다. */
    it.each([null, undefined, ''])('%s → 기본 로케일 + 루트', input => {
        expect(splitLocalePath(input)).toEqual({ locale: 'ko', path: '/' });
    });

    it('로케일처럼 생긴 티커는 건드리지 않는다', () => {
        expect(splitLocalePath('/KO')).toEqual({ locale: 'ko', path: '/KO' });
    });
});

describe('resolvePrerenderLocales', () => {
    /**
     * 빈 배열은 `[locale]`을 dynamic으로 떨어뜨려 전 라우트의 ISR을 끈다.
     * 어떤 입력이 와도 최소 하나는 나와야 한다.
     */
    it.each([undefined, '', '   ', 'xx,yy'])('%s → 기본 로케일로 폴백', raw => {
        expect(resolvePrerenderLocales(raw)).toEqual([DEFAULT_LOCALE]);
    });

    it('유효 로케일만 추리고 중복을 제거한다', () => {
        expect(resolvePrerenderLocales('ko, en ,xx,en')).toEqual(['ko', 'en']);
    });
});

describe('로케일 메타데이터', () => {
    it.each(LOCALES)('%s: 모든 표에 항목이 있다', locale => {
        expect(LOCALE_NATIVE_LABEL[locale]).toBeTruthy();
        expect(LOCALE_HREFLANG[locale]).toBeTruthy();
        expect(LOCALE_OG[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    });

    /** 간체/번체를 구분하지 않으면 대만·홍콩 사용자에게도 같은 URL이 제시된다. */
    it('중국어 hreflang은 스크립트까지 명시한다', () => {
        expect(LOCALE_HREFLANG.zh).toBe('zh-Hans');
    });

    it('isLocale은 신뢰 경계에서 임의 문자열을 거른다', () => {
        expect(isLocale('en')).toBe(true);
        expect(isLocale('EN')).toBe(false);
        expect(isLocale('unknown.txt')).toBe(false);
    });
});
