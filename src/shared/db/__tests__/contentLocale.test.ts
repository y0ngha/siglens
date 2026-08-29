import {
    CONTENT_LOCALE_FALLBACK,
    pickContentLocale,
    pickContentValue,
    toContentLocale,
} from '@/shared/db/contentLocale';
import { LOCALES } from '@/shared/i18n/locales';

describe('CONTENT_LOCALE_FALLBACK', () => {
    it.each(LOCALES)('%s: 자기 자신이 첫 번째다', locale => {
        expect(CONTENT_LOCALE_FALLBACK[locale][0]).toBe(locale);
    });

    /**
     * ja/zh 사용자에게는 한국어보다 영어가 읽힐 확률이 높다. 순서가 뒤집히면
     * 일본어 번역이 없는 뉴스가 영어 원문 대신 한국어로 나간다.
     */
    it.each(['ja', 'zh'] as const)('%s: 영어가 한국어보다 앞선다', locale => {
        const chain = CONTENT_LOCALE_FALLBACK[locale];
        expect(chain.indexOf('en')).toBeLessThan(chain.indexOf('ko'));
    });

    it.each(LOCALES)('%s: 체인에 중복이 없다', locale => {
        const chain = CONTENT_LOCALE_FALLBACK[locale];
        expect(new Set(chain).size).toBe(chain.length);
    });
});

describe('pickContentLocale', () => {
    it('요청 로케일이 있으면 폴백이 아니다', () => {
        expect(pickContentLocale({ ja: '日本語', ko: '한국어' }, 'ja')).toEqual(
            {
                value: '日本語',
                locale: 'ja',
                isFallback: false,
                fromSidecar: false,
            }
        );
    });

    it('없으면 체인 순서로 폴백하고 그 사실을 알린다', () => {
        expect(
            pickContentLocale({ ko: '한국어', en: 'English' }, 'ja')
        ).toEqual({
            value: 'English',
            locale: 'en',
            isFallback: true,
            fromSidecar: false,
        });
    });

    /**
     * DB에는 분석 실패로 **빈 문자열**이 들어간 행이 실제로 있다. 그것을
     * "번역됨"으로 취급하면 폴백이 막혀 빈 카드가 렌더된다.
     */
    it('빈 문자열·공백은 없는 것으로 보고 다음 후보로 넘어간다', () => {
        expect(pickContentLocale({ ja: '   ', en: 'English' }, 'ja')).toEqual({
            value: 'English',
            locale: 'en',
            isFallback: true,
            fromSidecar: false,
        });
    });

    it('null·undefined도 건너뛴다', () => {
        expect(
            pickContentLocale({ ja: null, en: undefined, ko: '한국어' }, 'ja')
        ).toEqual({
            value: '한국어',
            locale: 'ko',
            isFallback: true,
            fromSidecar: false,
        });
    });

    /**
     * 빈 문자열로 덮지 않는다 — "번역이 없다"와 "내용이 비었다"를 뭉개면
     * 폴백 배너를 띄울 근거가 사라진다.
     */
    /**
     * `fromSidecar`가 없으면 캐시가 교차 오염된다 — 레거시 `title_en` 같은
     * 컬럼에서 온 값도 "번역됨"으로 보고 캐시 행에 심는데, 스위치가 꺼진 동안엔
     * 캐시 키에 로케일이 없어 먼저 생성된 로케일의 값이 전 로케일에 굳는다.
     */
    it('사이드카에서 온 값만 fromSidecar가 참이다', () => {
        expect(
            pickContentLocale({ ja: '日本語' }, 'ja', new Set(['ja']))
        ).toEqual({
            value: '日本語',
            locale: 'ja',
            isFallback: false,
            fromSidecar: true,
        });
        // 같은 값이라도 사이드카 로케일 집합에 없으면 레거시 컬럼 출처다.
        expect(
            pickContentLocale({ ja: '日本語' }, 'ja', new Set(['en']))
        ).toMatchObject({ fromSidecar: false });
    });

    it('체인이 전부 비면 null을 돌려준다', () => {
        expect(pickContentLocale({}, 'ja')).toBeNull();
        expect(pickContentValue({}, 'ja')).toBeNull();
    });

    it('ko도 영어로 폴백한다 — 빈 화면보다 낫다', () => {
        expect(pickContentValue({ en: 'English' }, 'ko')).toBe('English');
    });

    it('문자열이 아닌 값은 빈 값 검사를 건너뛴다', () => {
        expect(pickContentValue<number>({ ja: 0 }, 'ja')).toBe(0);
    });
});

describe('toContentLocale', () => {
    it.each(LOCALES)('%s는 그대로 통과한다', locale => {
        expect(toContentLocale(locale)).toBe(locale);
    });

    /**
     * 백필 오류나 수기 SQL이 넣은 `'kr'` 같은 값은 **무시**한다 — 어느 언어인지
     * 모르는 문구를 화면에 붙이는 것보다 폴백이 낫다.
     */
    it.each(['kr', 'en-US', '', 'KO'])('알 수 없는 값 %s는 null', value => {
        expect(toContentLocale(value)).toBeNull();
    });

    it('null·undefined도 null', () => {
        expect(toContentLocale(null)).toBeNull();
        expect(toContentLocale(undefined)).toBeNull();
    });
});
