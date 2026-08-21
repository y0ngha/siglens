import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';

/**
 * DB 콘텐츠의 로케일 해석 규칙.
 *
 * 카탈로그(`messages/*.json`)는 코드가 소유하지만, 뉴스·공지·약관·AI 스냅샷처럼
 * **DB에 있는 문구**는 카탈로그로 옮길 수 없다. 이 모듈은 그 문구를 요청 로케일로
 * 고르는 단 하나의 규칙을 정의한다 — 호출부마다 `?? koField` 폴백을 다시 쓰면
 * 로케일마다 다른 규칙이 생긴다(실제로 `resolveNewsTitle` 하나만 로케일을 보고
 * 나머지는 전부 한국어를 우선하고 있었다).
 */

/**
 * 로케일별 폴백 순서.
 *
 * 영어를 한국어보다 앞에 두는 이유: ja/zh 사용자에게 한국어보다 영어가 읽힐
 * 확률이 훨씬 높다. ko 사용자에게도 영어 폴백을 허용하는 이유는 **빈 화면보다
 * 낫기 때문**이다 — 원문이 영어인 뉴스는 번역 전에도 헤드라인이 있어야 한다.
 *
 * 마지막 항목까지 없으면 호출부가 `null`을 받는다. 빈 문자열로 덮지 않는다 —
 * "번역이 없다"와 "내용이 빈 문자열이다"는 다른 상태이고, 후자로 뭉개면 폴백
 * 배너를 띄울 근거가 사라진다.
 */
export const CONTENT_LOCALE_FALLBACK: Record<Locale, readonly Locale[]> = {
    ko: ['ko', 'en'],
    en: ['en', 'ko'],
    ja: ['ja', 'en', 'ko'],
    zh: ['zh', 'en', 'ko'],
};

/**
 * 해석 결과. **값과 함께 어느 로케일에서 왔는지**를 돌려준다.
 *
 * `isFallback`이 필요한 이유는 약관·개인정보처리방침이다. 번역이 없어 한국어
 * 원문을 보여줄 때 사용자가 그 사실을 모르면, 읽지 못하는 문서에 동의하게 된다.
 * 화면이 "아직 번역되지 않았습니다" 안내를 띄울 수 있어야 한다.
 */
export interface LocalizedContent<T> {
    readonly value: T;
    /** 실제로 값을 제공한 로케일. */
    readonly locale: Locale;
    /** 요청 로케일과 다른 로케일에서 왔는가. */
    readonly isFallback: boolean;
    /**
     * 값이 **사이드카**에서 왔는가(레거시 컬럼이 아니라).
     *
     * ISR 캐시 키 때문에 필요하다. 뉴스 원본은 `title_ko`/`title_en` 두 컬럼을
     * 이미 갖고 있어서, 사이드카가 꺼져 있어도 해석 결과가 로케일별로 갈린다 —
     * 그 값을 캐시되는 행에 실으면 블롭이 로케일 의존이 되는데 키에는 로케일이
     * 없어(`contentLocaleKeyPart`가 꺼짐 상태에서 빈 배열) **먼저 생성된
     * 로케일의 헤드라인이 네 로케일 전부에 굳는다**(SEO 감사 라운드 1 S1).
     *
     * 레거시 컬럼만으로 갈리는 값은 캐시 뒤 렌더 시점에 `resolveNewsTitle`이
     * 처리한다 — 이 플래그가 그 둘을 가른다.
     */
    readonly fromSidecar: boolean;
}

/**
 * 로케일 → 값 맵에서 요청 로케일에 가장 가까운 값을 고른다.
 *
 * `null`·`undefined`·빈 문자열은 **없는 것으로 본다** — DB에는 분석 실패로 빈
 * 문자열이 들어간 행이 실제로 있고, 그것을 "번역됨"으로 취급하면 폴백이 막혀
 * 빈 카드가 렌더된다.
 */
export function pickContentLocale<T>(
    byLocale: Partial<Record<Locale, T | null | undefined>>,
    locale: Locale,
    /** 사이드카가 제공한 로케일 집합. 비면 전부 레거시 컬럼에서 온 것이다. */
    sidecarLocales: ReadonlySet<Locale> = new Set()
): LocalizedContent<T> | null {
    for (const candidate of CONTENT_LOCALE_FALLBACK[locale]) {
        const value = byLocale[candidate];
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && value.trim().length === 0) continue;
        return {
            value,
            locale: candidate,
            isFallback: candidate !== locale,
            fromSidecar: sidecarLocales.has(candidate),
        };
    }
    return null;
}

/** `pickContentLocale`의 값만 필요한 호출부용 축약. */
export function pickContentValue<T>(
    byLocale: Partial<Record<Locale, T | null | undefined>>,
    locale: Locale
): T | null {
    return pickContentLocale(byLocale, locale)?.value ?? null;
}

/**
 * DB 행에 붙은 로케일 문자열을 좁힌다.
 *
 * 컬럼은 `text`/enum이지만 읽기 경계에서 한 번 검증한다 — 마이그레이션 백필이
 * 잘못되거나 운영자가 손으로 넣은 행이 `'kr'` 같은 값을 들고 있으면, 그 행은
 * 조용히 무시되는 편이 낫다(어느 로케일인지 모르는 문구를 아무 화면에나
 * 붙이는 것보다).
 */
export function toContentLocale(
    value: string | null | undefined
): Locale | null {
    if (typeof value !== 'string') return null;
    return isLocale(value) ? value : null;
}

/**
 * 로케일 축이 **아직 DB에 없을 때**의 기본 로케일.
 *
 * 마이그레이션 전 행은 전부 한국어다. 백필이 `locale = 'ko'`를 채우기 전까지
 * 읽기 경로는 이 값을 그 행의 로케일로 간주한다.
 */
export const LEGACY_CONTENT_LOCALE = DEFAULT_LOCALE;
