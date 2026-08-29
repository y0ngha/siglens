import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import type { AssetInfo, TickerSearchResult } from '@/shared/lib/types';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

const KOREAN_UNICODE_REGEX = /[ㄱ-ㅣ가-힣]/;

/** Detect whether a search query contains any Hangul (Korean) character; used to route between Korean-name store and FMP search. */
export function isKoreanInput(query: string): boolean {
    return KOREAN_UNICODE_REGEX.test(query);
}

/** Deduplicate ticker search results by symbol, preserving first occurrence (stable). */
export function deduplicateResults(
    results: TickerSearchResult[]
): TickerSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
        if (seen.has(result.symbol)) return false;
        seen.add(result.symbol);
        return true;
    });
}

/**
 * 영문 법인명을 표시할지 판정하는 단일 소스.
 *
 * `buildDisplayName`(문자열 하나 조립)과 `SymbolLayoutHeader`(같은 판정을 span
 * 두 개로 나눠 렌더)가 각자 이 규칙을 베껴 구현했다가 갈라졌다 — 헤더 쪽은
 * `name !== ''` 가드가 빠져 있어서 이름이 빈 문자열인 종목(예: 시세만 있고
 * 이름이 없는 크립토)에서 `한글명, (TICKER)`처럼 빈 span과 낙오된 쉼표가
 * 렌더됐다. 두 소비자가 이 함수 하나로 판정하면 같은 페이지의 메타와 헤더가
 * 다른 이름을 말하는 사고가 구조적으로 불가능해진다.
 *
 * - `name`이 비어 있거나 `ticker`·`koreanName`과 같으면 보탤 게 없으므로 false.
 * - 국내 상장 종목은 영문 법인명이 한국어 SERP·UI에 보태는 게 없으면서
 *   meta description 예산(120자)을 잠식한다(§ buildDisplayName 사용처 참고).
 */
function shouldShowEnglishNameInKorean(
    name: string,
    koreanName: string | undefined,
    ticker: string
): boolean {
    return (
        name !== '' &&
        name !== ticker &&
        name !== koreanName &&
        !isKrEquitySymbol(ticker)
    );
}

/**
 * 영문 법인명을 노출할지 — **로케일까지 포함한** 최종 판정.
 *
 * 위의 `isKrEquitySymbol` 배제는 **한국어 전용 규칙**이다(한국어 SERP에서
 * 영문 법인명이 보태는 게 없으면서 meta description 120자 예산을 잠식한다).
 * 비-ko 로케일에는 그 논리가 성립하지 않는다 — `/en/005930.KS`를 보는 사람에게
 * `Samsung Electronics Co Ltd`는 유일하게 읽히는 이름이다.
 *
 * 이 구분을 놓쳐서, 헤더는 `shouldShowEnglishNameInKorean`을 로케일 무관하게
 * 부르고 `buildDisplayName`은 비-ko에서 평범한 `nameIsDifferent`를 써서 갈렸다.
 * 결과는 `/en/005930.KS`에서 브레드크럼 `삼성전자`, `<title>`
 * `Samsung Electronics Co Ltd` — 같은 페이지가 두 이름을 말했다.
 *
 * 그래서 배럴은 **이 함수만** 내보낸다. 로케일을 안 받는 쪽을 고를 수 없으면
 * 같은 사고가 구조적으로 안 난다.
 */
export function shouldShowEnglishName(
    name: string,
    koreanName: string | undefined,
    ticker: string,
    locale: Locale
): boolean {
    if (locale !== DEFAULT_LOCALE) return name !== '' && name !== ticker;
    return shouldShowEnglishNameInKorean(name, koreanName, ticker);
}

/**
 * 자산의 표준 표시 문자열.
 *
 * `locale`이 기본 로케일이 아니면 **한국어명을 앞세우지 않는다.** 예전에는
 * 로케일과 무관하게 `koreanName`을 우선해서, `/en/AAPL`의 `<title>`·`og`·
 * 헤더가 전부 `애플, Apple Inc. (AAPL)`로 나갔다 — 이 함수는 한국어 *리터럴*을
 * 담지 않고 한국어 *데이터*를 고르기 때문에 `i18n:lint` 기준선이 구조적으로
 * 볼 수 없었다.
 *
 * 영문명이 없으면(국내 종목 다수) 한국어명으로 떨어진다 — 티커만 남기는 것보다
 * 낫다. 그건 번역이 아니라 데이터 부재이고, `assetTranslations` 경로가 붙기
 * 전까지의 최선이다.
 */
/**
 * JSON-LD `about.name` 같은 **순수 이름**(티커 없이)을 로케일에 맞게 고른다.
 *
 * 8개 심볼 탭이 전부 `assetInfo.koreanName ?? assetInfo.name`을 썼다 — 그래서
 * `/en/AAPL`이 `inLanguage: "en"`을 선언하면서 `about.name: "애플"`을 내보냈다.
 * `composeSymbolTitle`이 같은 라운드에 고쳐진 그 결함이, 같은 문서 안 다른
 * 노드에 그대로 남아 있었다.
 */
export function pickAssetName(
    assetInfo: { name: string; koreanName?: string },
    ticker: string,
    locale: Locale
): string {
    const { name, koreanName } = assetInfo;
    if (locale !== DEFAULT_LOCALE) {
        if (name !== '' && name !== ticker) return name;
        return koreanName ?? name ?? ticker;
    }
    return koreanName ?? name ?? ticker;
}

export function buildDisplayName(
    assetInfo: AssetInfo | null,
    ticker: string,
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고,
    // 그 순간 그 페이지만 조용히 한국어명으로 되돌아간다.
    locale: Locale
): string {
    if (!assetInfo) return ticker;

    const { name, koreanName } = assetInfo;

    if (locale !== DEFAULT_LOCALE) {
        if (shouldShowEnglishName(name, koreanName, ticker, locale)) {
            return `${name} (${ticker})`;
        }
        return koreanName ? `${koreanName} (${ticker})` : ticker;
    }

    // `koreanName`이 없을 때도 같은 술어를 쓴다 — 화면 헤더
    // (`SymbolLayoutHeader`의 `hasCompanyName`)와 BreadcrumbList JSON-LD가
    // 갈라지면 구글이 마크업을 통째로 무시한다(SEO 감사 finding 2).
    const showEnglishName = shouldShowEnglishName(
        name,
        koreanName,
        ticker,
        locale
    );
    if (koreanName) {
        return showEnglishName
            ? `${koreanName}, ${name} (${ticker})`
            : `${koreanName} (${ticker})`;
    }
    return showEnglishName ? `${name} (${ticker})` : ticker;
}
