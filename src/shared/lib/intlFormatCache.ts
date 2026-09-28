/**
 * `Intl.NumberFormat`/`Intl.DateTimeFormat` 인스턴스 캐시.
 *
 * 포매터 생성은 비싸다(ICU 데이터 로드) — 렌더·요청마다 `new Intl.*`를 하지 않도록
 * (로케일, 옵션) 조합별로 한 번만 만들어 모듈 수명 동안 재사용한다. 예전에는 파일마다
 * `Map` + get/set 보일러플레이트를 따로 갖고 있었다.
 *
 * 키는 `locale` + `JSON.stringify(options)`다. 호출부 옵션은 모듈에 적힌 리터럴이라
 * 속성 순서가 고정이고, 조합 수도 (로케일 4개 × 호출부 옵션 몇 개)로 유한하다 —
 * 사용자 입력을 옵션에 넣으면 캐시가 무한히 자랄 수 있으니 그렇게 쓰지 말 것.
 *
 * `locale`은 BCP 47 태그(`INTL_LOCALE[locale]`, 또는 고정 `'en-CA'` 등)다.
 */
const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>();
const DATE_TIME_FORMATS = new Map<string, Intl.DateTimeFormat>();

function cacheKey(locale: string, options: object | undefined): string {
    return `${locale}|${JSON.stringify(options ?? {})}`;
}

export function cachedNumberFormat(
    locale: string,
    options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
    const key = cacheKey(locale, options);
    let formatter = NUMBER_FORMATS.get(key);
    if (formatter === undefined) {
        formatter = new Intl.NumberFormat(locale, options);
        NUMBER_FORMATS.set(key, formatter);
    }
    return formatter;
}

export function cachedDateTimeFormat(
    locale: string,
    options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
    const key = cacheKey(locale, options);
    let formatter = DATE_TIME_FORMATS.get(key);
    if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat(locale, options);
        DATE_TIME_FORMATS.set(key, formatter);
    }
    return formatter;
}
