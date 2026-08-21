import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    localePath,
    LOCALE_HREFLANG,
    type Locale,
} from '@/shared/i18n/locales';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { localeAlternates, localeOpenGraph } from '@/shared/lib/seoAlternates';
import {
    isKrEquitySymbol,
    type AssetClass,
} from '@/shared/config/marketProfile';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';

export interface BreadcrumbItem {
    name: string;
    url: string;
}

/**
 * `next-intl`의 `getTranslations`/`useTranslations` 반환값과 구조적으로 호환되는
 * 최소 형태. 이 파일이 `next-intl`을 직접 import하지 않는 이유(CLAUDE.md "pure
 * logic 모듈에 외부 라이브러리 금지" — provider는 entity/shared adapter가 감싼다):
 * 이 파일은 순수 문자열 조립 로직이고, 번역 SDK는 호출부(`generateMetadata` 등)가
 * 이미 알고 있다. 그래서 SDK 자체가 아니라 그 인터페이스만 여기 선언해 받는다.
 *
 * **기본값을 두지 않는다.** 기본값을 두면 호출부가 조용히 `t`를 누락해도 컴파일이
 * 통과하고, 그 결과 title/description이 `shared.seo.<key>` 같은 raw 키 문자열로
 * 렌더된다 — 이 브랜치에서 이미 두 차례 감사 라운드를 태운 실수다. 필수 파라미터로
 * 두면 컴파일러가 모든 호출부를 강제로 나열해 준다.
 */
export type SeoTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

/**
 * 호스트가 로컬/개발 환경인지 판단한다.
 *
 * 다음 케이스를 로컬/개발 환경으로 간주하고 SITE_URL 검증에서 제외한다:
 *  - localhost, 127.0.0.1, 0.0.0.0, ::1 (루프백)
 *  - 도트(.)가 없는 단순 호스트 — TLD 없음, 예: "app", "myserver"
 *  - *.local 접미사 — mDNS/Bonjour 로컬 호스트명
 *
 * CI 환경에서 NEXT_PUBLIC_SITE_URL=http://localhost:4200 같은 값이 설정돼도
 * 빌드가 깨지지 않도록 하기 위한 예외 조건이다.
 */
function isLocalOrDevHost(host: string): boolean {
    // 루프백 주소 및 명시적 로컬 호스트명
    if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1'
    ) {
        return true;
    }
    // TLD 없는 단순 호스트명 (도트 미포함)
    if (!host.includes('.')) {
        return true;
    }
    // *.local mDNS 호스트명
    if (host.endsWith('.local')) {
        return true;
    }
    return false;
}

function parseHostname(rawUrl: string): string {
    try {
        return new URL(rawUrl).hostname;
    } catch {
        throw new Error(
            `[seo] NEXT_PUBLIC_SITE_URL="${rawUrl}"은 유효한 URL이 아닙니다.`
        );
    }
}

/**
 * 사이트 URL. 환경 변수가 설정된 경우 그 값을, 없으면 기본값 'https://siglens.io'을 사용한다.
 *
 * 프로덕션 가드: NODE_ENV==='production'이고 NEXT_PUBLIC_SITE_URL이 설정됐는데
 * 호스트가 실제 원격 도메인이면서 'siglens.io'가 아닐 때 모듈 로드 시 즉시 throw한다.
 * 잘못된 프리뷰/ALB 도메인이 canonical·OG URL을 오염시키는 것을 빠른 실패로 막는다.
 *
 * 예외 — 아래 호스트는 로컬/개발/CI 환경으로 간주해 throw하지 않는다:
 *   localhost, 127.0.0.1, 0.0.0.0, ::1, TLD 없는 단순 호스트, *.local
 * 변수가 설정되지 않은 경우(기본값 사용)도 검사 대상이 아니므로 통과시킨다.
 */
function resolveSiteUrl(): string {
    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const url = fromEnv ?? 'https://siglens.io';

    if (process.env.NODE_ENV === 'production' && fromEnv !== undefined) {
        const host = parseHostname(url);
        // 로컬/개발/CI 호스트는 빌드 안전을 위해 검증에서 제외한다.
        if (!isLocalOrDevHost(host) && host !== 'siglens.io') {
            throw new Error(
                `[seo] NEXT_PUBLIC_SITE_URL="${url}"의 호스트가 siglens.io가 아닙니다. ` +
                    `canonical/OG URL이 오염되는 것을 막기 위해 빠른 실패합니다.`
            );
        }
    }

    return url;
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = 'Siglens';

/**
 * Shared metadata for the noindex early-returns on the `[symbol]` routes
 * (invalid ticker, infra-degraded asset, FMP-degraded profile).
 *
 * `canonical: null` is the important part: it OVERRIDES the root layout's
 * `alternates.canonical: SITE_URL`, so a noindexed symbol page does not falsely
 * advertise the homepage as its canonical. Without it these early-returns
 * inherit the layout canonical (a wrong cross-page signal).
 */
export const NOINDEX_SYMBOL_METADATA: Metadata = {
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

// 빌드 시각 — 매 요청마다 변동되면 안 되는 schema.org datePublished 등에 사용.
// NEXT_BUILD_DATE env가 있으면 우선, 없으면 모듈 로드 시각(deploy 시점)을 한 번만 캐시.
function parseBuildDate(): Date {
    const raw = process.env.NEXT_BUILD_DATE;
    if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}
export const SITE_BUILD_DATE = parseBuildDate();

/**
 * 한글 SERP description 안전권. Google 한국어 SERP에서 모바일은 ~80자,
 * 데스크톱은 ~120자 안팎에서 절단되므로 120자를 상한으로 둔다.
 * 현재 모든 빌더는 이미 90~115자 범위로 짧지만, 입력(displayName/sector)
 * 변화로 인한 회귀를 막기 위해 출력단에서 한 번 더 강제한다.
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 120;

/**
 * 입력이 SEO_DESCRIPTION_MAX_LENGTH 이하면 그대로, 초과 시 잘라내고 말줄임표(…)를 붙인다.
 * 말줄임표는 1자로 계산해 최종 길이가 항상 SEO_DESCRIPTION_MAX_LENGTH 이하가 되게 한다.
 *
 * 길이/슬라이스는 모두 code point 기준으로 처리해 surrogate pair(이모지,
 * supplementary plane 한자 등)가 split되어 invalid UTF-16이 되는 것을 막는다.
 */
export function clampSeoDescription(text: string): string {
    const codePoints = [...text];
    if (codePoints.length <= SEO_DESCRIPTION_MAX_LENGTH) return text;
    return (
        codePoints
            .slice(0, SEO_DESCRIPTION_MAX_LENGTH - 1)
            .join('')
            .trimEnd() + '…'
    );
}

/**
 * SERP에서 차지하는 시각적 폭을 근사한다 — 한글·전각 2, 그 외 1.
 *
 * Google 데스크톱 title 예산은 약 58~60 폭단위다. 글자 수로 재면 한글 제목의
 * 잘림을 예측할 수 없다: `AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선 | Siglens`은
 * 41글자지만 58 폭단위로 이미 경계에 있다(2026-07-26 실측 — 이 함수로 직접 측정).
 *
 * 코드포인트 기준으로 순회해 서로게이트 페어를 쪼개지 않는다
 * ({@link clampSeoDescription}과 동일한 방침).
 */
export function seoTitleWidth(text: string): number {
    return [...text].reduce(
        (width, ch) =>
            width + (isFullWidthCodePoint(ch.codePointAt(0) ?? 0) ? 2 : 1),
        0
    );
}

/**
 * 전각으로 취급할 코드포인트인지.
 *
 * 커버 범위: 한글 자모(U+1100–U+115F), 한글 음절(U+AC00–U+D7A3), CJK 통합
 * 표의문자 등(U+2E80–U+A4CF), CJK 호환 한자(U+F900–U+FAFF), CJK 호환 기호
 * (U+FE30–U+FE6F), 전각 형태(U+FF00–U+FF60, U+FFE0–U+FFE6), 그리고 이모지는
 * Miscellaneous Symbols and Pictographs(U+1F300–U+1F64F)·Supplemental
 * Symbols and Pictographs(U+1F900–U+1F9FF) 두 블록만 전각으로 취급한다.
 * 범위는 Unicode East Asian Width의 W/F 구간 중 이 서비스가 실제로 다루는
 * 것만 추렸다.
 *
 * 커버되지 않는 이모지 블록도 있다 — Transport and Map Symbols(🚀 U+1F680),
 * Miscellaneous Symbols(⭐ U+2B50), Dingbats(✅ U+2705)는 모두 1 폭단위로
 * 계산된다(실측 확인됨). 현재 12개 title 템플릿은 이모지를 쓰지 않으므로
 * 범위를 넓히지 않았다 — 넓히면 이미 실측해 둔 폭 수치가 전부 달라진다.
 *
 * Ambiguous-width 문자(`·` U+00B7, `—` U+2014, `…` U+2026)는 Unicode East
 * Asian Width 기준 Ambiguous(A) 등급이라 한국어 로케일 SERP에서는 넓게
 * 렌더링될 수 있지만, 이 함수는 의도적으로 좁은(1 폭단위) 문자로 취급한다.
 * `—`·`·`는 사실상 모든 title 템플릿에 등장해 2로 세면 12개 템플릿을 전부
 * 재조정해야 하는데, `SEO_TITLE_MAX_WIDTH`(55)는 이미 58~60 예산 대비
 * 3~5 폭단위 여유가 있어 그 재조정의 안전 이득이 작다. 게다가 Google의
 * 실제 절단은 픽셀 기준이라 어떤 유닛 모델도 근사치일 뿐이다. 이 문단은
 * 좁게 처리한 것이 실수가 아니라 의도된 선택임을 남기기 위한 것이다.
 */
function isFullWidthCodePoint(cp: number): boolean {
    return (
        (cp >= 0x1100 && cp <= 0x115f) || // 한글 자모
        (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK 부수 ~ 이(Yi)
        (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
        (cp >= 0xf900 && cp <= 0xfaff) || // CJK 호환 한자
        (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 호환 기호
        (cp >= 0xff00 && cp <= 0xff60) || // 전각 형태
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f) || // 이모지 (Misc Symbols and Pictographs)
        (cp >= 0x1f900 && cp <= 0x1f9ff) // 이모지 (Supplemental Symbols and Pictographs)
    );
}

/**
 * title 폭 상한. Google 데스크톱 예산 58~60에서 안전 여유를 둔 값이다.
 *
 * 이 상한은 **안전망**이지 상시 절단 수단이 아니다. 정상 템플릿은 클램프 없이
 * 통과해야 하며, `ASE 테크놀로지 홀딩스(ASX)`(26 폭단위) 같은 예외적으로 긴
 * 한국어명에서만 발동한다.
 */
export const SEO_TITLE_MAX_WIDTH = 55;

/**
 * 폭 상한을 넘으면 어절 경계에서 잘라 말줄임표를 붙인다.
 *
 * 말줄임표 자체가 1 폭단위를 쓰므로 예산에서 미리 뺀다. 공백이 없어 경계를
 * 찾지 못하면 폭 기준으로 그냥 자른다(무한정 길어지는 것보다 낫다).
 *
 * `maxWidth`가 1 미만이면 말줄임표(1 폭단위)조차 담을 자리가 없으므로
 * 빈 문자열을 반환한다 — 그 외에는 예산이 0 밑으로 내려가지 않도록
 * `Math.max(0, maxWidth - 1)`로 방어한다.
 */
export function clampSeoTitle(
    title: string,
    maxWidth: number = SEO_TITLE_MAX_WIDTH
): string {
    if (seoTitleWidth(title) <= maxWidth) return title;
    if (maxWidth < 1) return '';

    const budget = Math.max(0, maxWidth - 1);
    const chars = [...title];
    let width = 0;
    let cut = 0;
    // reduce 대신 for loop을 쓰는 이유: 조기 break와 index(cut = i + 1)가
    // 핵심 로직이라 CONVENTIONS §Coding Paradigm의 명시적 예외에 해당한다.
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === undefined) break;
        const w = seoTitleWidth(ch);
        if (width + w > budget) break;
        width += w;
        cut = i + 1;
    }

    const head = chars.slice(0, cut).join('');
    const lastSpace = head.lastIndexOf(' ');
    const body = lastSpace > 0 ? head.slice(0, lastSpace) : head;
    return `${body.trimEnd()}…`;
}

/**
 * title 전용 짧은 주어 — `애플(AAPL)`.
 *
 * `buildDisplayName`(`애플, Apple Inc. (AAPL)`, 21자·23 폭단위)은 H1·본문용이라
 * title에는 너무 길다. title 예산 58~60 폭단위 중 23 폭단위를 주어에 쓰면
 * 검색 의도를 드러낼 자리가 남지 않는다.
 *
 * `entities/ticker`가 아니라 여기 두는 이유: 12개 SEO 빌더가 전부
 * `BuildSymbolSeoOptions`(또는 이를 extends한 타입)를 받고 그 안에 `koreanName`이
 * 이미 있다. 여기서 파생하면 호출부 시그니처를 하나도 바꾸지 않는다.
 *
 * 중복 판정(`koreanName`이 티커와 사실상 같은 값)은 대소문자를 무시한다
 * (`kr.toUpperCase() !== upper`) — 티커 레이어의 나머지 비교도 전부
 * 대소문자 무시다(`searchTickerAction.ts`의 `.toLowerCase()`, `api.ts`의
 * SQL `lower(...)`). `ticker`가 빈 문자열이면 `koreanName`만 반환해
 * `'애플()'` 같은 빈 괄호 출력을 막는다.
 *
 * 이 함수는 trim과 대소문자 무시 중복 제거를 적용하지만, 형제 키워드
 * 빌더(`buildSymbolKeywords` 등)는 `koreanName`을 truthy 체크만 거쳐
 * 원시값 그대로 보간한다 — 의도적 비대칭이다. `keywords` 메타 태그는
 * 2009년경부터 Google·Naver 모두 무시하므로, 그쪽을 맞춰 고치는 것은
 * 낭비다.
 */
export function buildTitleSubject(ticker: string, koreanName?: string): string {
    const upper = titleTicker(ticker);
    const kr = koreanName?.trim();
    if (!kr) return upper;
    if (!upper) return kr;
    if (kr.toUpperCase() === upper) return upper;
    return `${kr}(${upper})`;
}

/**
 * title에 노출할 티커 표기. 국내 상장 종목은 거래소 접미사(`.KS`/`.KQ`)를 뗀다.
 *
 * 접미사는 yahoo 벤더 규약이고 한국 검색량이 0이다 — 실제로 검색되는 건 6자리 코드다.
 * 반면 폭 예산은 3단위를 먹어서, 실측상 KR 타이틀 120개(20종목 × 6탭) 중 21개가
 * 서술 tail을 떨어뜨리고 있었고 그중 15개가 접미사만 빼면 되살아난다.
 *
 * **표기에만 적용한다.** canonical·URL·라우팅·JSON-LD 식별자는 접미사가 있어야
 * 종목을 특정할 수 있으므로 그대로 둔다.
 */
function titleTicker(ticker: string): string {
    const upper = ticker.toUpperCase();
    return isKrEquitySymbol(upper)
        ? upper.replace(KR_EXCHANGE_SUFFIX_RE, '')
        : upper;
}

export interface ComposeSymbolTitleArgs {
    ticker: string;
    koreanName?: string;
    /** 비-기본 로케일에서 `koreanName` 자리에 들어간다. */
    englishName?: string;
    /** 생략하면 기본 로케일로 본다 — 한국어명을 그대로 노출한다. */
    locale?: Locale;
    /** 검색 매칭을 만드는 키워드. 티커를 줄여서라도 보존한다 — `core` 자체가 예산(55 폭단위)을
     *  넘지 않는 한 잘리지 않는다. 예: `공포 탐욕 지수` */
    core: string;
    /** 예산이 남을 때만 붙는 서술. 가장 먼저 버려진다. 예: `차트·매매 신호` */
    tail?: string;
}

/**
 * 심볼 title을 예산 안에서 조립한다 — 3단으로 물러난다.
 *
 * 1. `한국어명(TICKER) core — tail`
 * 2. `한국어명(TICKER) core`            tail을 버린다
 * 3. `TICKER core — tail` 또는 `TICKER core`   한국어명을 버린다
 *
 * **버리는 순서가 설계의 핵심이다.** 검색 매칭을 만드는 건 `주가 전망`·`공포 탐욕 지수`
 * 같은 core이지 뒤의 서술이 아니다. 단순 클램프(뒤에서 자르기)를 쓰면 긴 한국어명을 가진
 * 종목에서 core가 통째로 날아간다 — 실측상 264개 중 90개(34%)가 그 경우였다.
 *
 * 3단까지 가는 종목은 실측 2개뿐이다(NVDL 47, LABU 42 폭단위). 둘 다 레버리지 ETF로
 * 한국어명이 서술적이고(`그래닛셰어스 2배 레버리지 NVDA 데일리 ETF`) 실제 검색어는
 * 티커다. 그래서 이 경우 한국어명을 **자르지 않고 버린다** — 중간에 잘린 이름은
 * SERP에서 읽히지 않는 데다 검색어와도 맞지 않는다.
 */
export function composeSymbolTitle(args: ComposeSymbolTitleArgs): string {
    const { ticker, core, tail } = args;
    /**
     * 비-기본 로케일에서는 **한국어명을 title에 넣지 않는다.**
     *
     * 이 함수는 21개 빌더가 공유하므로 여기서 한 번에 거른다 — 빌더마다
     * 고치면 하나만 빠뜨려도 그 탭만 조용히 한국어 제목으로 남는다.
     * `/en/AAPL`이 `애플(AAPL) Stock Forecast …`로 나가던 결함이다.
     *
     * `keywords`는 대상이 아니다 — 설계 §5.1에서 ko 전용 데이터로 확정했다.
     */
    // 이름이 로케일을 타므로 `koreanName`이라는 이름은 더 이상 맞지 않다.
    const titleName =
        args.locale === undefined || args.locale === DEFAULT_LOCALE
            ? args.koreanName
            : args.englishName;
    const withTail = (subject: string) =>
        tail ? `${subject} ${core} — ${tail}` : `${subject} ${core}`;
    const fits = (t: string) => seoTitleWidth(t) <= SEO_TITLE_MAX_WIDTH;

    const subject = buildTitleSubject(ticker, titleName);
    const full = withTail(subject);
    if (fits(full)) return full;

    const coreOnly = `${subject} ${core}`;
    if (fits(coreOnly)) return coreOnly;

    /**
     * 이름을 통째로 버리기 전에 **법인 접미사만** 떼어 본다.
     *
     * 폭 예산(55)은 한글 기준으로 잡혔고 라틴 문자는 1단위라, 영문 법인명은
     * `Samsung Electronics Co., Ltd.(005930)`처럼 쉽게 37단위를 먹는다. 그래서
     * 국내 종목의 비-ko 제목이 8개 탭 중 4개에서 `005930 Overall Analysis`가
     * 됐다 — 숫자만 남는 제목이다. `Apple Inc.`처럼 짧은 이름으로만 검증해서
     * 처음엔 못 봤다.
     *
     * `Co., Ltd.`·`Inc.`·`Corp.` 같은 접미사는 검색어에도 안 쓰이고 화면에서
     * 읽히지도 않는다 — 이름 자체를 버리는 것보다 이걸 먼저 버린다.
     */
    const shortName = titleName?.replace(
        /[,]?\s*(?:Co\.?,?\s*Ltd\.?|Corporation|Corp\.?|Incorporated|Inc\.?|Limited|Ltd\.?|PLC|S\.A\.|AG|NV|SE)\s*$/i,
        ''
    );
    if (shortName && shortName !== titleName) {
        const shortSubject = buildTitleSubject(ticker, shortName);
        const shortFull = withTail(shortSubject);
        if (fits(shortFull)) return shortFull;
        const shortCore = `${shortSubject} ${core}`;
        if (fits(shortCore)) return shortCore;
    }

    const bare = buildTitleSubject(ticker);
    const coreSuffix = ` ${core}`;
    const bareFull = withTail(bare);
    if (fits(bareFull)) return bareFull;

    // 마지막 방어선: core는 그대로 두고 티커 쪽만 줄인다. `clampSeoTitle`을 전체
    // 문자열에 걸면 뒤에서부터 자르므로 core가 깎인다 — 3단 설계의 목적이 무너진다.
    const tickerBudget = SEO_TITLE_MAX_WIDTH - seoTitleWidth(coreSuffix);
    return `${clampSeoTitle(bare, tickerBudget)}${coreSuffix}`;
}

/**
 * Maps each SEO pre-warm snapshot tab to the primary Korean prose field its
 * `content` carries (verified against `src/views/symbol/snapshot/renderers/*`,
 * spec 2026-07-24 Task 4~6): technical→`summary`, overall→`headlineKo`,
 * fundamental/financials→`overallConclusionKo`, congress→`summaryKo`,
 * options→`summary`, news→`currentDriverKo`.
 *
 * Declared as `Record<string, string>` (not `SeoSnapshotTab`) — `shared` may not
 * import `entities/seo-snapshot` (FSD layer direction: entities→shared, not the
 * reverse). Callers in `entities`/`app` pass the typed `SeoSnapshotTab` value,
 * which structurally satisfies `string`.
 */
const SNAPSHOT_META_DESCRIPTION_FIELD: Record<string, string> = {
    technical: 'summary',
    overall: 'headlineKo',
    fundamental: 'overallConclusionKo',
    financials: 'overallConclusionKo',
    congress: 'summaryKo',
    options: 'summary',
    news: 'currentDriverKo',
};

/** Collapses `\n`-separated topic lines into a single space-joined line (mirrors the renderers' paragraph-split convention, but for a one-line `<meta description>` excerpt). */
function collapseToSingleLine(text: string): string {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ');
}

// FIX 5 (audit): only accept a sentence-ending punctuation mark as a clamp
// point if it falls within this many code points of the hard cutoff — a
// boundary near the START of an over-length string would clamp far shorter
// than necessary, wasting most of the SERP snippet budget.
const SENTENCE_BOUNDARY_SEARCH_WINDOW = 40;
const SENTENCE_TERMINATORS = new Set(['.', '!', '?']);

/** True when `codePoints[index]` is a `.` sitting between two digits (a decimal point, e.g. "3.5%"), not a sentence-ending period. */
function isDecimalPoint(codePoints: readonly string[], index: number): boolean {
    if (codePoints[index] !== '.') return false;
    const prev = codePoints[index - 1];
    const next = codePoints[index + 1];
    return (
        prev !== undefined &&
        next !== undefined &&
        /\d/.test(prev) &&
        /\d/.test(next)
    );
}

/**
 * Clamps `text` to `maxLength` code points, preferring to cut at the last
 * sentence-ending punctuation (`.`/`!`/`?`) within
 * {@link SENTENCE_BOUNDARY_SEARCH_WINDOW} code points of the hard cutoff
 * (audit fix FIX 5) — a full final sentence reads better in a SERP snippet
 * than a mid-sentence cut. Falls back to the original hard-truncate +
 * ellipsis behavior (matching {@link clampSeoDescription}) when no boundary
 * is found in that window. Code-point based throughout, same as
 * `clampSeoDescription`, to avoid splitting a surrogate pair.
 */
function clampAtSentenceBoundary(text: string, maxLength: number): string {
    const codePoints = [...text];
    if (codePoints.length <= maxLength) return text;

    const truncated = codePoints.slice(0, maxLength - 1);
    const windowStart = Math.max(
        0,
        truncated.length - SENTENCE_BOUNDARY_SEARCH_WINDOW
    );
    for (let i = truncated.length - 1; i >= windowStart; i--) {
        const char = truncated[i];
        if (
            char !== undefined &&
            SENTENCE_TERMINATORS.has(char) &&
            !isDecimalPoint(codePoints, i)
        ) {
            return truncated
                .slice(0, i + 1)
                .join('')
                .trimEnd();
        }
    }
    return truncated.join('').trimEnd() + '…';
}

/**
 * Derives a unique `<meta name="description">` excerpt from a pre-warmed SEO
 * snapshot's primary prose field, for the given tab, prefixed with `subject`
 * (audit fix FIX 5). Returns `null` when the tab is unrecognized, `content`
 * is not an object, the field is missing/not a string, or the field is empty
 * after trimming — callers should fall back to the existing templated
 * `buildSymbol*SeoContent(...).description` in that case (spec 2026-07-24
 * Task 8; unchanged by FIX 5).
 *
 * `subject` (ticker or `"${koreanName}, ${name} (${ticker})"` display name,
 * matching the value each of the 7 `generateMetadata` call sites already
 * resolves) is prefixed BEFORE clamping — every templated builder
 * (`buildSymbol*SeoContent`) leads with the subject, and the target queries
 * ("AAPL 주가 전망") need it for the bolded query-term match in the SERP
 * snippet; raw prose alone was losing that.
 *
 * `content` is deliberately `unknown` — the same defensive-narrowing contract
 * as the `*SnapshotProse` renderers (storage type is `unknown`, tab-specific
 * schemas differ). This function does NOT validate the full response shape,
 * only the single field it reads.
 */
export function buildSnapshotMetaDescription(
    tab: string,
    content: unknown,
    subject: string,
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고,
    // 그 탭만 조용히 한국어 설명으로 되돌아간다(`buildDisplayName`과 같은 규약).
    locale: Locale
): string | null {
    /**
     * 스냅샷은 **로케일 없이** 저장된다 — `getSeoSnapshotsStatic(ticker, …)`에
     * 로케일 인자가 없다. 그래서 `content`의 산문은 항상 한국어다.
     *
     * 이걸 그대로 쓰면 `/en/AAPL`의 `<meta name="description">`이
     * `Apple Inc. (AAPL) — 애플(AAPL) 주식은 최근 급락 이후…`가 되고, 같은
     * 문서의 `og:description`은 영어라 **한 페이지가 두 언어로 말한다.**
     *
     * 비-ko에서는 null을 반환해 템플릿 설명(번역됨)으로 떨어진다. 스냅샷이
     * 로케일별로 저장되면 이 게이트를 로케일 비교로 바꾸면 된다.
     */
    if (locale !== DEFAULT_LOCALE) return null;

    const field = SNAPSHOT_META_DESCRIPTION_FIELD[tab];
    if (field === undefined) return null;
    if (typeof content !== 'object' || content === null) return null;

    const raw = (content as Record<string, unknown>)[field];
    if (typeof raw !== 'string') return null;

    const singleLine = collapseToSingleLine(raw);
    if (singleLine.length === 0) return null;

    return clampAtSentenceBoundary(
        `${subject} — ${singleLine}`,
        SEO_DESCRIPTION_MAX_LENGTH
    );
}

/**
 * 홈 카피(제목·설명·헤드라인)는 `shared.seo.root` 카탈로그가 소유한다.
 *
 * 예전에는 여기 한국어 상수로 있었다 — 그래서 `/en`의 홈 JSON-LD가
 * `inLanguage: "en"`을 달고 한국어 산문을 실어 보냈다. 이 모듈은 요청 스코프가
 * 없으므로 문구를 들 수 없고, 소비 지점(레이아웃·홈 페이지)이 번역자로 읽는다.
 */

// 한글 SERP는 80~120자가 안전권이라 키워드는 핵심 검색의도 위주로 추렸다.
export const ROOT_KEYWORDS = [
    'Siglens',
    '미국 주식 AI 분석',
    '미국 주식 차트 분석',
    '미국 주식 펀더멘털',
    '미국 주식 뉴스',
    '미국 주식 옵션',
    'AI 종합 분석',
    '공포 탐욕 지수',
    'AI 주식 백테스팅',
    '오늘의 미국 주식',
    '섹터별 주식 분석',
    '미국 주식 PER',
    '한국 주식 AI 분석',
    '코스피 종목 분석',
    '코스닥 종목 분석',
    '국내 주식 차트 분석',
    '암호화폐 분석',
    '비트코인 시세',
    '이더리움 시세',
    '코인 AI 분석',
    '암호화폐 차트 분석',
    '비트코인 차트',
];

function buildSymbolDescription(
    t: SeoTranslator,
    displayName: string,
    sector?: string
): string {
    return sector
        ? t('symbol.chart.descriptionWithSector', {
              subject: displayName,
              sector,
          })
        : t('symbol.chart.description', { subject: displayName });
}

export interface SymbolSeoContent {
    ticker: string;
    title: string;
    fullTitle: string;
    description: string;
    url: string;
    keywords: string[];
}

export interface BuildSymbolSeoOptions {
    /** Resolved display name (e.g. "애플, Apple Inc. (AAPL)"). Falls back to ticker. */
    displayName?: string;
    /** Korean company name; expands keyword set when present. */
    koreanName?: string;
    /**
     * 영문 법인명. **비-기본 로케일 title에서 한국어명을 대신한다.**
     *
     * 없으면 title은 티커만 남는다 — 국내 종목에서는 그게
     * `005930 Stock Forecast — Chart & Trading Signals`처럼 **숫자만 덩그러니**
     * 남는 제목이 된다. 같은 페이지 `<h1>`은
     * `Samsung Electronics Co., Ltd. (005930.KS)`로 제대로 나오는데도.
     */
    englishName?: string;
    /**
     * URL 로케일. 비-기본 로케일이면 **title에서 한국어명을 뺀다**
     * (`keywords`는 §5.1대로 ko 전용이라 영향 없음).
     */
    locale?: Locale;
    /** Sector name (English, FMP-style — e.g. "Technology"); woven into description when present. */
    sector?: string;
}

export function buildSymbolSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.chart.titleCore'),
        tail: t('symbol.chart.titleTail'),
    });
    const displayName = opts.displayName ?? ticker;
    return {
        ticker,
        title,
        fullTitle: `${title} | ${SITE_NAME}`,
        description: clampSeoDescription(
            buildSymbolDescription(t, displayName, opts.sector)
        ),
        url: `${SITE_URL}/${ticker}`,
        keywords: buildSymbolKeywords(ticker, displayName, opts.koreanName),
    };
}

function buildSymbolKeywords(
    ticker: string,
    displayName: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 주가`,
        `${ticker} 주가 전망`,
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 매수`,
        `${ticker} 매도`,
        `${ticker} 매매 시점`,
        `${ticker} 매매 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 주가 분석`,
        `${displayName} 차트 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [
                  `${koreanName} 주가`,
                  `${koreanName} 주가 전망`,
                  `${koreanName} 매수`,
                  `${koreanName} 매도`,
                  `${koreanName} 매매 시점`,
                  `${koreanName} 차트 분석`,
              ]
            : []),
    ];
}

/**
 * 8개 심볼 페이지가 공유하는 WebPage JSON-LD 노드를 생성한다.
 * `about`은 stock으로 분류된 경우에만 채워지며, 없으면 키 자체를 생략한다.
 *
 * 반환 형태:
 * {
 *   "@context": "https://schema.org",
 *   "@type": "WebPage",
 *   "@id": `${url}#webpage`,
 *   name, description, url,
 *   inLanguage: "ko",
 *   isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}#website` },
 *   ...(about && { about }),
 * }
 */
/**
 * 절대 URL에 로케일 접두사를 붙인다.
 *
 * JSON-LD의 `url`·`@id`는 **canonical과 같은 문서를 가리켜야 한다.** 예전에는
 * 기본 로케일 URL을 그대로 실어서, `/en/AAPL`이
 * `<link rel="canonical" href=".../en/AAPL">`를 걸어 놓고 `WebPage.url`은
 * `.../AAPL`을 말했다. 더 나쁜 건 `@id`다 — `${url}#webpage`라서 **네 로케일이
 * 전부 같은 `@id`를 발행하면서** 각자 다른 `inLanguage`와 `name`을 선언했다.
 * 한 노드를 네 문서가 동시에 자처하는 상태다.
 */
export function localizedAbsoluteUrl(url: string, locale: Locale): string {
    // 기본 로케일은 접두사가 없다. 원본을 그대로 돌려줘야 `SITE_URL`처럼
    // 경로가 빈 URL에 `/`가 새로 붙는 일이 없다.
    if (locale === DEFAULT_LOCALE) return url;
    const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
    return `${SITE_URL}${localePath(locale, path || '/')}`;
}

export function buildWebPageJsonLd(params: {
    url: string;
    name: string;
    description: string;
    about?: Record<string, unknown>;
    /**
     * 이 문서의 언어. **기본값을 두지 않는다** — 두면 호출부에서 빠져도
     * 컴파일이 통과하고, 그 페이지만 조용히 `ko`를 자처한다. `/en/AAPL`의
     * `WebPage`가 `inLanguage: "ko"`를 달고 있던 게 그 결과다(형제 `Article`
     * 노드는 이미 로케일을 따르고 있어 한 페이지 안에서 서로 어긋났다).
     */
    locale: Locale;
}): Record<string, unknown> {
    const { url, name, description, about, locale } = params;
    const localizedUrl = localizedAbsoluteUrl(url, locale);
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${localizedUrl}#webpage`,
        name,
        description,
        url: localizedUrl,
        // `<html lang>`과 같은 태그를 쓴다 — `zh`는 `<html lang="zh-Hans">`인데
        // JSON-LD만 `zh`를 선언해 한 문서가 두 언어 태그를 말하고 있었다.
        inLanguage: LOCALE_HREFLANG[locale],
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        ...(about && { about }),
    };
}

/**
 * 8개 심볼 페이지 `generateMetadata`가 반환하는 Metadata 객체를 생성한다.
 * SymbolSeoContent의 `title/fullTitle/description/url/keywords` 5개 필드를
 * Next.js Metadata 형태로 매핑한다. 동일한 구조가 8 곳에 중복됐던 것을 제거.
 *
 * `title`은 `{ absolute: title }`로 반환해 루트 레이아웃의 `title.template`
 * (`%s | Siglens` 자동 접미사)을 무시한다 — `| Siglens` 8글자(폭단위 8)를
 * 2,247개 URL 전부에서 검색 의도 카피에 되돌려준다. 브랜드 검색어("siglens")는
 * 이미 자연 순위 2.0위라 title 폭을 추가로 쓸 이유가 없다. `/backtesting`이
 * 같은 `absolute` 메커니즘을 쓰지만 그쪽은 반대로 `fullTitle`(브랜드 포함)을
 * 넣는다 — 단일 페이지라 폭 제약이 이만큼 타이트하지 않고 브랜드 노출도 원해서다.
 * `openGraph.title`·`twitter.title`은 그대로 `fullTitle`을 쓴다 — 소셜 카드는
 * SERP 폭 제약이 없고 브랜드 노출이 도움이 된다.
 *
 * options/page.tsx의 `robots` 스프레드는 호출측이 직접 추가해야 한다:
 * `return { ...symbolMetadataFromSeo(seo), ...(hasOptions ? {} : { robots }) };`
 */
export function symbolMetadataFromSeo(
    seo: SymbolSeoContent,
    locale: Locale
): Metadata {
    const { title, fullTitle, description, url, keywords } = seo;
    // `seo.url`은 기본 로케일 절대 URL이다. 경로만 떼어 로케일별 URL을 다시 만든다.
    const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
    const localizedUrl = `${SITE_URL}${localePath(locale, path || '/')}`;
    return {
        title: { absolute: title },
        description,
        keywords,
        // hreflang은 **분석 본문이 준비된 로케일만** 광고한다. 준비되지 않은
        // 로케일을 광고하면 한국어 본문이 담긴 영어 URL을 크롤러에게 권하는 셈이다.
        // 준비된 로케일이 하나뿐이면 `buildLanguageAlternates`가 빈 객체를 돌려주고
        // `languages` 키 자체가 나가지 않는다.
        alternates: localeAlternates(locale, path, {
            canonical: localizedUrl,
            available: SYMBOL_INDEXABLE_LOCALES,
        }),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: localizedUrl,
            ...localeOpenGraph(locale),
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
        /**
         * 준비되지 않은 로케일은 **제목·설명은 그대로 두고 robots만** 덮는다.
         *
         * 이전에는 `getBlockedSymbolMetadata`가 통째로 `NOINDEX_SYMBOL_METADATA`를
         * 돌려줬는데, 그 상수엔 title이 없다. 그래서 `/en/AAPL`의 `<title>`이
         * 루트 레이아웃의 **한국어 사이트 기본 제목**으로 떨어졌다 — 브라우저 탭·
         * 북마크·`og:title`이 전부 그렇게 나갔고, `og:image`만 종목별이라 공유하면
         * AAPL 차트에 한국어 일반 문구가 붙었다.
         *
         * `follow: true`인 이유는 정적 페이지 게이트(`localeRobots`)와 같다 —
         * 색인은 막되 링크는 따라가게 둔다. 같은 게이트가 두 표면에서 다른
         * `follow` 값을 내면 그것 자체가 크롤 예산 결함이다.
         */
        ...(SYMBOL_INDEXABLE_LOCALES.includes(locale)
            ? {}
            : { robots: { index: false, follow: true } }),
    };
}

// 홈(Siglens → SITE_URL)이 첫 항목으로 자동 삽입된다.
// schema.org BreadcrumbList의 `item`은 절대 URL이어야 하므로
// 상대 경로로 들어온 trail은 SITE_URL prefix를 붙여 절대화한다.
export function buildBreadcrumbJsonLd(
    trail: readonly BreadcrumbItem[],
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고, 그
    // 페이지의 breadcrumb만 조용히 기본 로케일 URL을 가리킨다.
    locale: Locale
): Record<string, unknown> {
    const items: BreadcrumbItem[] = [
        { name: SITE_NAME, url: SITE_URL },
        ...trail,
    ];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: localizedAbsoluteUrl(
                item.url.startsWith('http')
                    ? item.url
                    : `${SITE_URL}${item.url}`,
                locale
            ),
        })),
    };
}

export const BACKTESTING_PATH = '/backtesting';
export const BACKTESTING_URL = `${SITE_URL}${BACKTESTING_PATH}`;
// Root layout template appends "| Siglens" — exclude brand name to prevent duplication
export function backtestingTitle(t: SeoTranslator): string {
    return t('backtesting.title');
}
export function backtestingDescription(t: SeoTranslator): string {
    return t('backtesting.description');
}
export const BACKTESTING_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '주식 AI 백테스팅',
    '기술적 분석 백테스팅',
    'AI 주식 예측 정확도',
    '주식 기술적 분석 정확도',
    'RSI 신호 백테스팅',
    'MACD 백테스팅',
    'AI 분석 신뢰도',
    'Magnificent 7 분석',
    'AI 주식 예측 검증',
    '기술적 분석 백테스트 무료',
    '주식 매매 신호 정확도',
    '미국 주식 백테스트',
];

/** Build SEO metadata for the `/[symbol]/financials` page. */
export function buildSymbolFinancialsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.financials.titleCore'),
        tail: t('symbol.financials.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFinancialsDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/financials`,
        keywords: buildSymbolFinancialsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolFinancialsDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.financials.description', { subject });
}

function buildSymbolFinancialsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 재무제표`,
        `${ticker} 손익계산서`,
        `${ticker} 재무상태표`,
        `${ticker} 현금흐름표`,
        `${ticker} 매출 성장`,
        `${ticker} 영업이익`,
        `${ticker} 재무 분석`,
        ...(koreanName
            ? [
                  `${koreanName} 재무제표`,
                  `${koreanName} 손익계산서`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 현금흐름`,
              ]
            : []),
        '재무제표 분석',
        '손익계산서',
        '재무상태표',
        '현금흐름표',
        '매출 성장',
        '영업이익',
        '순이익',
        '재무 건전성',
    ];
}

/** Build SEO metadata for the `/[symbol]/congress` page. */
export function buildSymbolCongressSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.congress.titleCore'),
        tail: t('symbol.congress.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolCongressDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/congress`,
        keywords: buildSymbolCongressKeywords(upper, opts.koreanName),
    };
}

function buildSymbolCongressDescription(
    t: SeoTranslator,
    subject: string
): string {
    // 공시지연 ~45일은 STOCK Act 규정상 거래일로부터 신고 마감까지의 최대치다.
    return t('symbol.congress.description', { subject });
}

function buildSymbolCongressKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 의회 거래`,
        `${ticker} 의원 매매`,
        `${ticker} 상원 의원 매매`,
        `${ticker} 하원 의원 매매`,
        `${ticker} 정치인 매매`,
        `${ticker} 공시`,
        ...(koreanName
            ? [
                  `${koreanName} 의회 거래`,
                  `${koreanName} 의원 매매`,
                  `${koreanName} 정치인 매매`,
              ]
            : []),
        '의회 거래',
        '의원 매매',
        '상원 의원 매매',
        '하원 의원 매매',
        '정치인 주식 매매',
        'STOCK Act',
        '의회 공시',
    ];
}

/** Build SEO metadata for the `/[symbol]/fundamental` page. */
export function buildSymbolFundamentalSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fundamental.titleCore'),
        tail: t('symbol.fundamental.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFundamentalDescription(t, subject, opts.sector)
        ),
        url: `${SITE_URL}/${upper}/fundamental`,
        keywords: buildSymbolFundamentalKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFundamentalDescription(
    t: SeoTranslator,
    subject: string,
    sector?: string
): string {
    return sector
        ? t('symbol.fundamental.descriptionWithSector', { subject, sector })
        : t('symbol.fundamental.description', { subject });
}

function buildSymbolFundamentalKeywords(
    ticker: string,
    sector?: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 펀더멘털 분석`,
        `${ticker} 재무 분석`,
        `${ticker} 밸류에이션`,
        `${ticker} 애널리스트 컨센서스`,
        `${ticker} 목표 주가`,
        ...(koreanName
            ? [
                  `${koreanName} 펀더멘털`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 밸류에이션`,
                  `${koreanName} 목표 주가`,
              ]
            : []),
        ...(sector ? [`${sector} 섹터 펀더멘털`] : []),
        '펀더멘털 분석',
        'PER',
        'PSR',
        'EPS',
        'ROE',
        '재무 건전성',
        '애널리스트 컨센서스',
        '목표 주가',
    ];
}

export interface BuildSymbolOptionsSeoOptions extends BuildSymbolSeoOptions {
    /**
     * `false`일 때 옵션 시장이 없는 종목으로 안내한다. metadata에서 robots를
     * noindex로 떨어뜨리는 신호로도 사용된다.
     */
    hasOptions?: boolean;
}

/** Build SEO metadata for the `/[symbol]/options` page. */
export function buildSymbolOptionsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolOptionsSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    const hasOptions = opts.hasOptions ?? true;
    const title = hasOptions
        ? composeSymbolTitle({
              ticker: upper,
              koreanName: opts.koreanName,
              englishName: opts.englishName,
              locale: opts.locale,
              core: t('symbol.options.titleCore'),
              tail: t('symbol.options.titleTail'),
          })
        : composeSymbolTitle({
              ticker: upper,
              koreanName: opts.koreanName,
              englishName: opts.englishName,
              locale: opts.locale,
              core: t('symbol.options.titleCore'),
          });
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            hasOptions
                ? t('symbol.options.description', { subject })
                : t('symbol.options.descriptionNoMarket', { subject })
        ),
        url: `${SITE_URL}/${upper}/options`,
        keywords: buildSymbolOptionsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOptionsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 옵션`,
        `${ticker} 옵션 분석`,
        `${ticker} Max Pain`,
        `${ticker} Put Call Ratio`,
        `${ticker} Open Interest`,
        `${ticker} Implied Volatility`,
        ...(koreanName
            ? [
                  `${koreanName} 옵션`,
                  `${koreanName} 옵션 시장`,
                  `${koreanName} 옵션 분석`,
              ]
            : []),
        '옵션 분석',
        '옵션 시장',
        'Max Pain',
        'Put/Call Ratio',
        'Implied Volatility',
        'Open Interest',
    ];
}

/** Build SEO metadata for the `/[symbol]/news` page. */
export function buildSymbolNewsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.news.titleCore'),
        tail: t('symbol.news.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolNewsDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/news`,
        keywords: buildSymbolNewsKeywords(upper, opts.koreanName),
    };
}

function buildSymbolNewsDescription(t: SeoTranslator, subject: string): string {
    return t('symbol.news.description', { subject });
}

function buildSymbolNewsKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} 뉴스`,
        `${ticker} 호재`,
        `${ticker} 악재`,
        `${ticker} 뉴스 분위기`,
        `${ticker} 소식`,
        `${ticker} 이슈`,
        `${ticker} 분석 의견`,
        `${ticker} 어닝 일정`,
        `${ticker} 실적 발표`,
        `${ticker} 애널리스트 등급`,
        `${ticker} 목표 주가`,
        ...(koreanName
            ? [
                  `${koreanName} 뉴스`,
                  `${koreanName} 호재`,
                  `${koreanName} 어닝`,
                  `${koreanName} 실적`,
                  `${koreanName} 목표 주가`,
              ]
            : []),
        '뉴스 분석',
        '뉴스 분위기',
        '뉴스 분석 의견',
        '주식 호재',
        '주식 악재',
        '주식 이슈',
        '주식 소식',
        '어닝 발표',
        '실적 발표',
        '애널리스트 등급',
        '주식 뉴스',
    ];
}

/** Build SEO metadata for the `/[symbol]/overall` page. */
export function buildSymbolOverallSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.overall.titleCore'),
        tail: t('symbol.overall.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    const subject = opts.displayName ?? upper;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolOverallDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/overall`,
        keywords: buildSymbolOverallKeywords(upper, opts.koreanName),
    };
}

function buildSymbolOverallDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.overall.description', { subject });
}

function buildSymbolOverallKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        ticker,
        `${ticker} AI 종합 분석`,
        `${ticker} 종합 분석`,
        `${ticker} 시나리오 분석`,
        `${ticker} 시나리오`,
        `${ticker} 진입 타이밍`,
        `${ticker} 위험 요인`,
        `${ticker} 매수 분위기`,
        `${ticker} 4축 분석`,
        ...(koreanName
            ? [
                  `${koreanName} 종합 분석`,
                  `${koreanName} AI 분석`,
                  `${koreanName} 시나리오 분석`,
                  `${koreanName} 매수 분위기`,
              ]
            : []),
        'AI 종합 분석',
        '시나리오 분석',
        '4축 분석',
        '기술적 분석',
        '펀더멘털 분석',
        '뉴스 분석',
    ];
}

function buildCryptoSymbolDescription(
    t: SeoTranslator,
    displayName: string
): string {
    return t('symbol.crypto.description', { subject: displayName });
}

function buildCryptoSymbolKeywords(
    ticker: string,
    displayName: string
): string[] {
    return [
        `${ticker} 시세`,
        `${ticker} 가격`,
        `${ticker} 시세 전망`,
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 매수`,
        `${ticker} 매도`,
        `${ticker} 매매 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 시세 분석`,
        `${displayName} 차트 분석`,
    ];
}

/** Build SEO metadata for a crypto `/[symbol]` chart page (crypto-framed copy). */
export function buildCryptoSymbolSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const displayName = opts.displayName ?? ticker;
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.crypto.titleCore'),
        // 크립토 chart title tail은 주식과 동일 문구("차트·매매 신호") —
        // `symbol.chart.titleTail` 키를 그대로 재사용해 두 카탈로그 값이
        // 번역 갱신 시 어긋나지 않게 한다.
        tail: t('symbol.chart.titleTail'),
    });
    return {
        ticker,
        title,
        fullTitle: `${title} | ${SITE_NAME}`,
        description: clampSeoDescription(
            buildCryptoSymbolDescription(t, displayName)
        ),
        url: `${SITE_URL}/${ticker}`,
        keywords: buildCryptoSymbolKeywords(ticker, displayName),
    };
}

/**
 * Options for `resolveSymbolSeoContent`. `displayName` is required here (unlike
 * the optional variant in `BuildSymbolSeoOptions`) because both call sites in
 * `src/app/[symbol]/page.tsx` have already resolved the display name before
 * calling this function. `koreanName` accepts `null` to match the raw DB field
 * type (the implementation normalises null→undefined before forwarding to
 * `buildSymbolSeoContent`).
 */
export interface ResolveSymbolSeoOpts {
    displayName: string;
    koreanName?: string | null;
    /** 비-기본 로케일 title에서 `koreanName`을 대신한다. */
    englishName?: string | null;
    /** URL 로케일. 비-기본 로케일이면 title에서 한국어명을 뺀다. */
    locale?: Locale;
}

/**
 * Resolves the correct chart-page SEO content for a symbol based on its asset
 * class. Crypto pages use `buildCryptoSymbolSeoContent` (price-framed copy:
 * "시세 전망"); stock/ETF/Index pages use `buildSymbolSeoContent` (equity-framed
 * copy: "주가 전망"). Both branches forward `koreanName` — `composeSymbolTitle`
 * (spec 2026-07-26 title surgery) injects the Korean name for either asset
 * class when one is available.
 *
 * Centralising this ternary here prevents the two call sites in
 * `src/app/[symbol]/page.tsx` (`generateMetadata` and `SymbolPage`) from
 * diverging independently as copy evolves.
 */
export function resolveSymbolSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    if (assetClass === 'crypto') {
        return buildCryptoSymbolSeoContent(ticker, t, {
            displayName: opts.displayName,
            koreanName: opts.koreanName ?? undefined,
            englishName: opts.englishName ?? undefined,
            locale: opts.locale,
        });
    }
    return buildSymbolSeoContent(ticker, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** Build SEO metadata for a crypto `/[symbol]/news` page (no 어닝/실적/애널리스트). */
export function buildCryptoSymbolNewsSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // Crypto news focuses on price catalysts and market sentiment — not earnings or analyst ratings.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.cryptoNews.titleCore'),
        tail: t('symbol.cryptoNews.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            t('symbol.cryptoNews.description', { subject })
        ),
        url: `${SITE_URL}/${ticker}/news`,
        keywords: buildCryptoSymbolNewsKeywords(ticker),
    };
}

function buildCryptoSymbolNewsKeywords(ticker: string): string[] {
    return [
        `${ticker} 뉴스`,
        `${ticker} 코인 뉴스`,
        `${ticker} 호재`,
        `${ticker} 악재`,
        `${ticker} 뉴스 분위기`,
        `${ticker} 시장 이슈`,
        `${ticker} 크립토 뉴스`,
        `${ticker} 소식`,
        `코인 뉴스 분석`,
        `크립토 뉴스`,
        `코인 호재`,
        `코인 악재`,
        `암호화폐 뉴스`,
        `코인 시장 분위기`,
        `비트코인 뉴스`,
    ];
}

/**
 * Select the correct news-page SEO builder by asset class.
 * Crypto uses `buildCryptoSymbolNewsSeoContent` (no 어닝/실적/애널리스트 copy);
 * equity uses `buildSymbolNewsSeoContent`.
 */
export function resolveSymbolNewsSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    if (assetClass === 'crypto') {
        return buildCryptoSymbolNewsSeoContent(ticker, t, {
            displayName: opts.displayName,
            koreanName: opts.koreanName ?? undefined,
            englishName: opts.englishName ?? undefined,
            locale: opts.locale,
        });
    }
    return buildSymbolNewsSeoContent(ticker, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** Build SEO metadata for a crypto `/[symbol]/overall` page (no 주가/분기실적/펀더멘털). */
export function buildCryptoSymbolOverallSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // Crypto overall axes: chart trend, news sentiment, fear-greed — no earnings/fundamental.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.cryptoOverall.titleCore'),
        tail: t('symbol.cryptoOverall.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            t('symbol.cryptoOverall.description', { subject })
        ),
        url: `${SITE_URL}/${ticker}/overall`,
        keywords: buildCryptoSymbolOverallKeywords(ticker),
    };
}

function buildCryptoSymbolOverallKeywords(ticker: string): string[] {
    return [
        `${ticker} AI 종합 분석`,
        `${ticker} 코인 종합 분석`,
        `${ticker} 시나리오 분석`,
        `${ticker} 시나리오`,
        `${ticker} 진입 타이밍`,
        `${ticker} 위험 요인`,
        `${ticker} 매수 분위기`,
        `AI 종합 분석`,
        `코인 시나리오 분석`,
        `크립토 종합 분석`,
        `코인 기술적 분석`,
        `암호화폐 AI 분석`,
    ];
}

/**
 * Select the correct overall-page SEO builder by asset class.
 * Crypto uses `buildCryptoSymbolOverallSeoContent` (chart/news/fear-greed axes only);
 * equity uses `buildSymbolOverallSeoContent`.
 */
export function resolveSymbolOverallSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    if (assetClass === 'crypto') {
        return buildCryptoSymbolOverallSeoContent(ticker, t, {
            displayName: opts.displayName,
            koreanName: opts.koreanName ?? undefined,
            englishName: opts.englishName ?? undefined,
            locale: opts.locale,
        });
    }
    return buildSymbolOverallSeoContent(ticker, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
    });
}

/** Build SEO metadata for a crypto `/[symbol]/fear-greed` page (coin-framed keywords). */
export function buildCryptoSymbolFearGreedSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const ticker = symbol.toUpperCase();
    const subject = opts.displayName ?? ticker;
    // Title/description mirrors the stock builder but substitutes coin-appropriate language.
    const title = composeSymbolTitle({
        ticker,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fearGreed.titleCore'),
        tail: t('symbol.fearGreed.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker,
        title,
        fullTitle,
        description: clampSeoDescription(
            // The fear-greed metric measures buying/selling pressure from price
            // position and volume flow — semantics that are identical for crypto
            // and equity.  Only the title and keywords need crypto-specific copy;
            // the description body is shared intentionally via buildSymbolFearGreedDescription.
            buildSymbolFearGreedDescription(t, subject)
        ),
        url: `${SITE_URL}/${ticker}/fear-greed`,
        keywords: buildCryptoSymbolFearGreedKeywords(ticker),
    };
}

function buildCryptoSymbolFearGreedKeywords(ticker: string): string[] {
    return [
        `${ticker} 공포 지수`,
        `${ticker} 탐욕 지수`,
        `${ticker} 코인 매수 분위기`,
        `${ticker} 매수세`,
        `${ticker} 단기 흐름`,
        `${ticker} 단기 심리`,
        `공포 탐욕 지수`,
        `코인 투자 심리`,
        `코인 매수 분위기`,
        `Fear Greed Index`,
        `크립토 투자 심리`,
        `암호화폐 매수 분위기`,
        `코인 단기 매매 심리`,
    ];
}

/**
 * Select the correct fear-greed-page SEO builder by asset class.
 * Crypto uses `buildCryptoSymbolFearGreedSeoContent` (coin-framed keywords);
 * equity uses `buildSymbolFearGreedSeoContent`.
 */
export function resolveSymbolFearGreedSeoContent(
    ticker: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: ResolveSymbolSeoOpts
): SymbolSeoContent {
    if (assetClass === 'crypto') {
        return buildCryptoSymbolFearGreedSeoContent(ticker, t, {
            displayName: opts.displayName,
            koreanName: opts.koreanName ?? undefined,
            englishName: opts.englishName ?? undefined,
            locale: opts.locale,
        });
    }
    return buildSymbolFearGreedSeoContent(ticker, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
        // sector is not forwarded — none of the fear-greed callers resolve a sector
        // (it's equity-tab metadata context, not tracked at this page level).
    });
}

/** Build SEO metadata for the `/[symbol]/fear-greed` page. */
export function buildSymbolFearGreedSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const subject = opts.displayName ?? upper;
    const title = composeSymbolTitle({
        ticker: upper,
        koreanName: opts.koreanName,
        englishName: opts.englishName,
        locale: opts.locale,
        core: t('symbol.fearGreed.titleCore'),
        tail: t('symbol.fearGreed.titleTail'),
    });
    const fullTitle = `${title} | ${SITE_NAME}`;
    return {
        ticker: upper,
        title,
        fullTitle,
        description: clampSeoDescription(
            buildSymbolFearGreedDescription(t, subject)
        ),
        url: `${SITE_URL}/${upper}/fear-greed`,
        keywords: buildSymbolFearGreedKeywords(
            upper,
            opts.sector,
            opts.koreanName
        ),
    };
}

function buildSymbolFearGreedDescription(
    t: SeoTranslator,
    subject: string
): string {
    return t('symbol.fearGreed.description', { subject });
}

function buildSymbolFearGreedKeywords(
    ticker: string,
    sector?: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 공포 지수`,
        `${ticker} 탐욕 지수`,
        `${ticker} 매수 분위기`,
        `${ticker} 매수세`,
        `${ticker} 단기 흐름`,
        `${ticker} 단기 심리`,
        ...(sector ? [`${sector} 섹터 매수 분위기`] : []),
        ...(koreanName
            ? [
                  `${koreanName} 공포 지수`,
                  `${koreanName} 탐욕 지수`,
                  `${koreanName} 매수 분위기`,
              ]
            : []),
        '공포 탐욕 지수',
        '투자 심리 지표',
        'Fear Greed Index',
        '주식 매수 분위기',
        '단기 매매 심리',
    ];
}
