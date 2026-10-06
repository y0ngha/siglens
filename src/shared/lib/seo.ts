import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    localePath,
    LOCALE_HREFLANG,
    type Locale,
} from '@/shared/i18n/locales';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { localeAlternates, localeOpenGraph } from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { type AssetClass } from '@/shared/config/marketProfile/types';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';
import { truncateWithEllipsis } from '@/shared/lib/truncate';

export interface BreadcrumbItem {
    name: string;
    url: string;
}

/** 화면 `<dl>`과 FAQPage 구조화데이터가 공유하는 질문·답변 한 쌍. */
export interface FaqItem {
    question: string;
    answer: string;
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
 * 운영 호스트. `SITE_URL`의 기본값·프로덕션 가드와, 환경과 무관하게 항상 운영
 * 도메인을 보여줘야 하는 표시 문구(`/about` 예시 주소창)가 함께 쓴다.
 */
export const SITE_HOST = 'siglens.io';

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
    const url = fromEnv ?? `https://${SITE_HOST}`;

    if (process.env.NODE_ENV === 'production' && fromEnv !== undefined) {
        const host = parseHostname(url);
        // 로컬/개발/CI 호스트는 빌드 안전을 위해 검증에서 제외한다.
        if (!isLocalOrDevHost(host) && host !== SITE_HOST) {
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
 * 브랜드의 한글 표기. 번역 대상이 아니라 고유명사라 카탈로그가 아닌 상수다.
 *
 * 영문 `Siglens`는 로그 관리 프로젝트 SigLens(siglens.com)와 이름이 겹쳐,
 * 검색엔진과 AI 답변 엔진이 두 주체를 구분할 단서가 없었다(2026-10-04 조사:
 * 브랜드 검색 상위가 전부 그쪽이고, 한글 표기는 사이트 어디에도 없었다).
 * `WebSite`·`Organization`의 `alternateName`과 ko 화면(푸터·소개·홈 FAQ)에
 * 같은 표기를 심어 한글 브랜드 검색이 이 사이트로 귀결되게 한다.
 *
 * 화면에 넣을 때는 ko 로케일에서만 보인다 — 다른 로케일 독자에게 한글 독음은
 * 의미가 없다. 구조화 데이터의 `alternateName`은 로케일과 무관하게 싣는다.
 */
export const SITE_NAME_KO = '시그렌즈';

/**
 * 문장에서 브랜드를 **처음 소개할 때** 쓰는 표기. ko는 한글 표기에 영문을
 * 괄호로 붙여 두 표기가 같은 서비스임을 한 번에 밝히고, 다른 로케일은 영문만 쓴다.
 *
 * 카탈로그 문구에 한글 표기를 직접 적지 않고 인자로 넘기는 이유: ko 문장만
 * 길어지면 번역 검증의 길이 게이트(`i18n:verify` 6번)가 다른 로케일을 잘린
 * 번역으로 본다.
 */
export function brandIntroName(locale: Locale): string {
    return locale === DEFAULT_LOCALE
        ? `${SITE_NAME_KO}(${SITE_NAME})`
        : SITE_NAME;
}

/**
 * 종목 디렉터리 경로. 페이지·푸터·sitemap이 같은 상수를 본다 — 한 곳만 바뀌면
 * 푸터가 404로 가는데 빌드도 테스트도 조용하다.
 */
export const SYMBOLS_PATH = '/symbols';

/**
 * 홈 `Organization` 노드의 `@id`. 홈 페이지(`(home)/page.tsx`)와 `/about`
 * 페이지가 각자 `${SITE_URL}#organization` 리터럴을 조립해 크롤러가 두 문서를
 * 같은 개체로 묶는 참조가 오타 하나로 갈릴 수 있었다 — 상수 하나로 묶는다.
 */
export const ORGANIZATION_JSON_LD_ID = `${SITE_URL}#organization`;

/** 사이트 발행 주체 `Organization`의 핵심 속성 — `buildOrganizationCoreJsonLd` 반환형. */
export interface OrganizationCoreJsonLd {
    readonly '@type': 'Organization';
    readonly '@id': string;
    readonly name: string;
    readonly url: string;
}

/**
 * 발행 주체 `Organization` 노드의 **핵심 속성**(`@id`·`name`·`url`).
 *
 * 전 페이지에 깔리는 `SiteJsonLd`가 `WebSite.publisher`의 참조 대상을 같은 문서 안에 두려고
 * 이 최소 노드를 싣고, 홈(`(home)/page.tsx`)은 이 위에 로고·설명·sameAs 등을 얹은 풍부한 노드를
 * 낸다. 같은 `@id`의 두 정의는 파서가 하나로 합치는데, 겹치는 속성 값이 다르면 충돌한다 —
 * 두 곳이 이 함수 하나에서 핵심 속성을 받아야 값이 갈릴 수 없다.
 */
export function buildOrganizationCoreJsonLd(): OrganizationCoreJsonLd {
    return {
        '@type': 'Organization',
        '@id': ORGANIZATION_JSON_LD_ID,
        name: SITE_NAME,
        url: SITE_URL,
    };
}

/**
 * 공개 소스 저장소. 푸터와 홈 `Organization.sameAs`가 소비자다.
 *
 * 상수로 두는 이유는 재사용이 아니라 **위치**다. 사이트를 가리키는 다른 URL이
 * 전부 여기 있으므로, JSON-LD `sameAs`에 싣는 소셜 프로필(`X_URL`)도 이 파일
 * 안에서 함께 다룬다. 푸터 JSX나 JSON-LD 안에 문자열로 박아두면 두 번째 사본이
 * 생긴다.
 */
export const GITHUB_URL = 'https://github.com/y0ngha/siglens';

/**
 * 서비스 공식 X(트위터) 계정. 홈 `Organization.sameAs`와 푸터 아이콘 링크가 소비한다.
 */
export const X_URL = 'https://x.com/siglens_io';

/**
 * 종목은 살아 있지만 **탭 자체를 색인하지 않기로 정한** 페이지의 robots.
 *
 * 2026-10-01 SEO 감사(`docs/architecture/SEO_RECOVERY_2026_09.md` §10)로 종목별
 * 색인을 차트·뉴스·공포탐욕 세 탭으로 좁혔다. overall·fundamental·financials·
 * congress·options 다섯 탭은 이 값을 쓴다.
 *
 * `NOINDEX_SYMBOL_METADATA`(실존하지 않는 종목·degrade용)와 같은 robots이고 둘 다
 * self-canonical을 쓴다 — 이 페이지들은 정상 페이지라 제목·설명도 그대로 둔다.
 * `follow: true`인 이유는 `NOINDEX_SYMBOL_METADATA` 주석과 같다(형제 탭 크롤 경로).
 *
 * 다섯 페이지가 같은 상수를 써야 sitemap 빌더(`buildPopularEntries`)의 "이 탭은
 * 싣지 않는다"와 한 곳에서 대응된다. 탭을 다시 열 때는 여기가 아니라 각 페이지에서
 * 이 값을 걷어내고 sitemap 빌더에 엔트리를 되돌린다.
 */
export const ALWAYS_NOINDEX_TAB_ROBOTS = {
    index: false,
    follow: true,
} as const satisfies NonNullable<Metadata['robots']>;

/**
 * `[symbol]` 라우트 noindex 분기의 robots — **색인은 막고 링크는 따라가게** 둔다.
 *
 * `follow: true`인 이유: 차단된 심볼 페이지도 본문에 같은 심볼의 다른 탭(뉴스·공포탐욕…)
 * 링크를 렌더하므로, nofollow는 크롤러가 그 형제 탭에 도달하는 유일한 경로를 막는다.
 * `[symbol]/options/page.tsx`가 옵션 없는 종목에 대해 이미 `{ index: false, follow: true }`를
 * 쓰고 같은 근거를 남겨 뒀다.
 *
 * **canonical은 이 상수의 몫이 아니다 (2026-10-05).** 예전에는 `alternates: { canonical: null }`을
 * 함께 담아 루트 레이아웃의 홈 canonical 상속을 막았는데, canonical이 없는 noindex 페이지는
 * 신호가 비어 크롤러가 URL 군집을 스스로 추정하게 둔다. 항상-noindex 탭(`ALWAYS_NOINDEX_TAB_ROBOTS`)
 * 과 같은 방식 — **자기 URL을 가리키는 self-canonical** — 으로 통일했다. 심볼을 아는 분기는
 * `noindexSymbolMetadata`가 `symbolMetadataFromSeo`의 self-canonical을 낸다. 심볼이라 믿을 수 없는
 * 세그먼트(`!isAdmissibleSymbolShape`)는 메타를 내지 않고 `generateMetadata`에서 `notFound()`를
 * 던져 404 경계(`[locale]/not-found.tsx`)의 메타를 쓴다.
 * 이 상수를 그대로 반환하면 canonical 없이 루트 레이아웃의 홈 title·og·twitter를 상속하므로
 * 라우트에서 직접 반환하지 않는다 — robots가 필요한 곳(스프레드·테스트)에서만 쓴다.
 * (루트 레이아웃 자체는 canonical을 깔지 않는다 — `[locale]/layout.tsx` 참고.)
 */
export const NOINDEX_SYMBOL_METADATA: Metadata = {
    robots: { index: false, follow: true },
};

/**
 * Tabs that have their own SEO copy builder. The seven snapshot tabs mirror
 * `SeoSnapshotTab` (`entities/seo-snapshot`), which `shared` may not import —
 * the builders live here, so the union is declared here and the entity's
 * values flow in. `technical` is the chart route (the symbol root), whose copy
 * is the base {@link buildSymbolSeoContent}.
 *
 * `fear-greed`는 스냅샷 탭이 아니지만 자기 제목 카피가 있다. 여기 없으면 점수가 안 나와
 * noindex로 막힌 공포·탐욕 페이지가 차트 탭 제목을 그대로 써 한 종목에 같은 title이
 * 두 개가 된다(2026-10-05 운영 재크롤: TOSCF·SLROF). 스냅샷 탭과 갈라야 하는 곳은
 * `isSeoSnapshotTab`(entities/seo-snapshot)으로 거른다.
 *
 * `position`도 같은 이유로 들어 있다 — 차단 메타가 차트 탭 카피를 쓰면 `/{symbol}`과
 * `/{symbol}/position`이 같은 title·description을 낸다(네이버 중복 감지, #949와 같은 부류).
 */
export type SymbolSeoTab =
    | 'technical'
    | 'overall'
    | 'fundamental'
    | 'financials'
    | 'congress'
    | 'news'
    | 'options'
    | 'fear-greed'
    | 'position';

/**
 * 색인되는 `[symbol]` 탭(= `ALWAYS_NOINDEX_TAB_ROBOTS`를 쓰지 않는 탭). 차트(`technical`)·뉴스·
 * 공포탐욕 세 개다.
 *
 * 항상-noindex 탭으로 가는 링크는 크롤 예산만 쓰고 색인 신호를 만들지 못한다 — 그런 링크를 내는
 * 곳(카드 그리드 등)이 이 목록으로 대상을 좁힌다. 탭을 다시 열 때는 `ALWAYS_NOINDEX_TAB_ROBOTS`와
 * sitemap 빌더에 더해 여기에도 추가한다.
 */
export const INDEXABLE_SYMBOL_TABS = [
    'technical',
    'news',
    'fear-greed',
] as const satisfies readonly SymbolSeoTab[];

/**
 * 탭별 `titleCore` 카탈로그 키 — 자산군 분기가 있는 탭만 `crypto`를 갖는다.
 *
 * `SYMBOL_SEO_TAB_BUILDERS`/`resolveSymbol*SeoContent`가 제목을 만들 때 쓰는
 * 키와 **같은 값**이어야 한다. 어긋나면 description 프리픽스가 제목과 다른
 * 말을 하게 되므로, `__tests__/symbolTabDescriptionLabel.test.ts`가 탭×자산군 전수로
 * "제목이 라벨을 포함한다"를 단언해 드리프트를 막는다.
 */
const SYMBOL_TAB_LABEL_KEYS: Record<
    SymbolSeoTab,
    { readonly equity: string; readonly crypto?: string }
> = {
    technical: {
        equity: 'symbol.chart.titleCore',
        crypto: 'symbol.crypto.titleCore',
    },
    overall: {
        equity: 'symbol.overall.titleCore',
        crypto: 'symbol.cryptoOverall.titleCore',
    },
    fundamental: { equity: 'symbol.fundamental.titleCore' },
    financials: { equity: 'symbol.financials.titleCore' },
    congress: { equity: 'symbol.congress.titleCore' },
    news: {
        equity: 'symbol.news.titleCore',
        crypto: 'symbol.cryptoNews.titleCore',
    },
    options: { equity: 'symbol.options.titleCore' },
    // 크립토 빌더도 같은 키를 쓴다(`buildCryptoSymbolFearGreedSeoContent`).
    'fear-greed': { equity: 'symbol.fearGreed.titleCore' },
    // position 제목은 `{훅} — {주어} {라벨}` 꼴이라 titleCore 대신 브레드크럼 라벨이 그 자리다.
    position: { equity: 'position.breadcrumb' },
};

/**
 * `<meta name="description">` 프리픽스에 쓰는 탭 라벨 — `주가 분석`, `펀더멘털`처럼
 * 제목의 `titleCore`와 같은 말이다.
 *
 * **왜 필요한가 (2026-09-20 네이버 중복 감지)**: 스냅샷 파생 description은 AI 산문의
 * 앞머리를 잘라 쓰는데, 한 종목의 두 탭이 같은 도입 문장으로 시작하면(ETF·인버스처럼
 * "이게 무슨 상품인지"로 여는 종목) 클램프 지점 전에 갈라지지 않아 **완전히 같은
 * 문자열**이 된다. 실측: `/SOXS/overall`과 `/SOXS/fundamental`이 193자까지 동일했고
 * 둘 다 `index, follow`였다. 프리픽스에 탭 라벨을 넣으면 충돌이 구조적으로 불가능하다.
 */
export function symbolTabDescriptionLabel(
    tab: SymbolSeoTab,
    assetClass: AssetClass,
    t: SeoTranslator
): string {
    const keys = SYMBOL_TAB_LABEL_KEYS[tab];
    return t(
        assetClass === 'crypto' && keys.crypto ? keys.crypto : keys.equity
    );
}

type SymbolSeoBuilder = (
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions
) => SymbolSeoContent;

/**
 * 탭×자산군 → SEO 카피 빌더. `SYMBOL_TAB_LABEL_KEYS`와 같은 모양(크립토 변형이 있는
 * 탭만 `crypto`)이라 두 테이블의 분기가 한눈에 대응된다.
 *
 * `resolveSymbol*SeoContent`와 `noindexSymbolMetadata`가 **이 테이블 하나로** 자산군을
 * 고른다. 예전에는 차단 메타 경로만 equity 빌더를 고정으로 써서, 크립토의 차단된 탭이
 * `시세` 대신 `주가`/`Stock` 카피를 냈다(MISTAKES §6.7 — 같은 규칙을 형제 경로 하나에만 적용).
 */
const SYMBOL_SEO_TAB_BUILDERS: Record<
    SymbolSeoTab,
    { readonly equity: SymbolSeoBuilder; readonly crypto?: SymbolSeoBuilder }
> = {
    technical: {
        equity: buildSymbolSeoContent,
        crypto: buildCryptoSymbolSeoContent,
    },
    overall: {
        equity: buildSymbolOverallSeoContent,
        crypto: buildCryptoSymbolOverallSeoContent,
    },
    fundamental: { equity: buildSymbolFundamentalSeoContent },
    financials: { equity: buildSymbolFinancialsSeoContent },
    congress: { equity: buildSymbolCongressSeoContent },
    news: {
        equity: buildSymbolNewsSeoContent,
        crypto: buildCryptoSymbolNewsSeoContent,
    },
    options: { equity: buildSymbolOptionsSeoContent },
    'fear-greed': {
        equity: buildSymbolFearGreedSeoContent,
        crypto: buildCryptoSymbolFearGreedSeoContent,
    },
    position: { equity: buildSymbolPositionSeoContent },
};

/** 탭·자산군에 맞는 빌더로 SEO 카피를 만든다 — 크립토 변형이 없는 탭은 equity 빌더를 쓴다. */
export function buildSymbolTabSeoContent(
    tab: SymbolSeoTab,
    symbol: string,
    assetClass: AssetClass,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const builders = SYMBOL_SEO_TAB_BUILDERS[tab];
    const build =
        assetClass === 'crypto' && builders.crypto
            ? builders.crypto
            : builders.equity;
    return build(symbol, t, opts);
}

export interface NoindexSymbolMetadataOptions extends Omit<
    BuildSymbolSeoOptions,
    'locale'
> {
    /**
     * The tab this route renders. Without it every blocked tab of one symbol
     * repeats the chart page's title and description, which Naver Search
     * Advisor reports as duplicate `<title>`/`<meta name="description">`
     * documents (2026-09-17: `/QQQ/financials` carried the `/QQQ` title).
     * Omitted means the chart tab (`technical`).
     */
    tab?: SymbolSeoTab;
    /**
     * 자산군. 크립토면 `시세`/`Price` 카피 빌더를 쓴다 — 생략하면 equity다. 호출부가
     * `assetInfo`를 들고 있으면 `getDescriptor(marketProfileOf(assetInfo)).assetClass`를 넘긴다.
     */
    assetClass?: AssetClass;
}

/**
 * noindex인 `[symbol]` 라우트의 메타데이터 — **심볼을 알 때** 쓴다.
 *
 * **왜 필요한가 (2026-08-24 프로덕션 실측)**: `title`/`description`/`openGraph`를
 * 비워 두면 Next가 루트 레이아웃 값을 그대로 상속시킨다. 그 결과 차단된 심볼
 * URL 전부(`/SOXX`, `/QQQM`, `/TLT`, `/XLK`, `/SOXX/fundamental` …)가
 *   - 홈페이지와 **똑같은** `<title>`·`<meta name="description">`을 쓰고,
 *   - `og:url`을 `https://siglens.io`로 선언한다.
 * 두 번째가 특히 나쁘다 — og:url을 정규 URL 힌트로 쓰는 크롤러에게 수만 개
 * 심볼 URL이 자기를 홈페이지라고 말하는 셈이다. noindex는 색인을 막을 뿐
 * 이 잘못된 동일성 선언까지 막아 주지는 않는다.
 *
 * **`[symbol]/**\/page.tsx`의 200 + noindex 분기는 전부 이걸 쓴다**(FMP profile degrade,
 * 빈 재무 스냅샷, congress trades degrade, overall 캐시 미스 …). 전부 심볼이 확정된 뒤라
 * 자기 정체성을 가질 수 있고, **실존 티커가 200을 반환하는 경로**라 홈 메타 상속이 실제로
 * 크롤된다. 404로 끝나는 경로(형식 불합격 `!isAdmissibleSymbolShape`, tab-not-allowed,
 * assetInfo 없음·장애 중 형상 불합격)는 여기로 오지 않는다 — `generateMetadata`가
 * `notFound()`를 던져 404 경계의 메타를 쓴다. 레이아웃이 먼저 `notFound()`를 던져도 페이지의
 * `generateMetadata` 결과가 이기므로, 그 경로에서 메타를 돌려주면 404 응답에 정상 페이지
 * title·canonical이 얹힌다.
 *
 * `opts.tab`이 있으면 그 탭의 카피·URL을 쓴다 — 없으면 차트 탭(`technical`)이다.
 *
 * `opts`는 호출부가 이미 `assetInfo`를 들고 있을 때만 넘긴다 — 안 넘겨도
 * displayName이 티커로 폴백해 동작은 같고, 있으면 description이 사명까지 담는다.
 *
 * URL 로케일은 세 번째 인자 하나로만 받아 빌더에도 그대로 넘긴다(`opts`에는 `locale`이 없다).
 * 예전에는 빌더에 로케일을 넘기지 않아 `composeSymbolTitle`이 기본 로케일로 동작했고,
 * `/en/AAPL`의 차단 메타 title이 `애플(AAPL) Stock Analysis`처럼 한국어명을 달고 나갔다.
 */
export function noindexSymbolMetadata(
    symbol: string,
    t: SeoTranslator,
    locale: Locale,
    opts: NoindexSymbolMetadataOptions = {}
): Metadata {
    const { tab = 'technical', assetClass = 'equity', ...buildOpts } = opts;
    const base = symbolMetadataFromSeo(
        buildSymbolTabSeoContent(tab, symbol, assetClass, t, {
            ...buildOpts,
            locale,
        }),
        locale
    );
    return {
        ...base,
        // self-canonical은 유지하고 hreflang 군집(`languages`)만 뺀다 — noindex 페이지가
        // 다른 로케일 URL과 상호 참조(return tag)를 주장할 이유가 없다.
        alternates: { canonical: base.alternates?.canonical ?? null },
        // robots(noindex)가 symbolMetadataFromSeo의 index 기본값을 덮는다.
        ...NOINDEX_SYMBOL_METADATA,
    };
}

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
 *
 * **템플릿 description에만 적용한다.** 스냅샷 본문 발췌(`buildSnapshotMetaDescription`)와
 * 그 계열(공포·탐욕 사실 설명)은 문장 단위로만 자르므로 더 넉넉한
 * {@link SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH}(160)를 쓴다.
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 120;

/**
 * 스냅샷 본문에서 만든 description의 상한(code point).
 *
 * 템플릿 description은 위 120자 안에서 끝나지만, 본문 발췌는 **문장 단위로만** 자르므로
 * 문장 하나가 더 들어갈 여유가 있어야 한다. 120자에서는 첫 문장이 예산을 넘겨 `…`로
 * 잘리는 일이 잦았다(2026-10-05 운영 크롤: 구분자 접두 `{displayName} {label} — `만 최대
 * 86자를 먹었다). 접두를 짧은 주어로 바꾸고 상한을 160자로 둔다.
 */
export const SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH = 160;

/**
 * 입력이 SEO_DESCRIPTION_MAX_LENGTH 이하면 그대로, 초과 시 잘라내고 말줄임표(…)를 붙인다.
 * 말줄임표는 1자로 계산해 최종 길이가 항상 SEO_DESCRIPTION_MAX_LENGTH 이하가 되게 한다.
 *
 * 길이/슬라이스는 모두 code point 기준으로 처리해 surrogate pair(이모지,
 * supplementary plane 한자 등)가 split되어 invalid UTF-16이 되는 것을 막는다.
 */
export function clampSeoDescription(text: string): string {
    return truncateWithEllipsis(text, SEO_DESCRIPTION_MAX_LENGTH, {
        trimEnd: true,
    });
}

/**
 * SERP에서 차지하는 시각적 폭을 근사한다 — 한글·전각 2, 그 외 1.
 *
 * Google 데스크톱 title 예산은 약 58~60 폭단위다. 글자 수로 재면 한글 제목의
 * 잘림을 예측할 수 없다: `AAPL 주가 분석 — 차트와 기술적 신호, 지지선·저항선 | Siglens`은
 * 42글자지만 58 폭단위로 이미 경계에 있다(2026-07-26 실측 — 이 함수로 직접 측정).
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
    // 이름이 이미 `)`로 끝나면(`삼성전자우(보통주)` 류) 괄호가 겹쳐 `이름(보통주)(CODE)`가
    // 된다 — 공백으로 이어 괄호 한 쌍만 남긴다.
    if (kr.endsWith(')')) return `${kr} ${upper}`;
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
    /** 예산이 남을 때만 붙는 서술. 가장 먼저 버려진다. 예: `차트·기술적 신호` */
    tail?: string;
}

/**
 * 심볼 title을 예산 안에서 조립한다 — 3단으로 물러난다.
 *
 * 1. `한국어명(TICKER) core — tail`
 * 2. `한국어명(TICKER) core`            tail을 버린다
 * 3. `TICKER core — tail` 또는 `TICKER core`   한국어명을 버린다
 *
 * **버리는 순서가 설계의 핵심이다.** 검색 매칭을 만드는 건 `주가 분석`·`공포 탐욕 지수`
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

/**
 * Collapses `\n`-separated topic lines into a single space-joined line (mirrors the renderers' paragraph-split convention, but for a one-line `<meta description>` excerpt).
 *
 * 마크다운 기호를 먼저 뗀다 — 스냅샷 필드는 화면에서 `MarkdownText`로 그리는 마크다운이라,
 * 그대로 두면 SERP 스니펫에 `**종합 진단**:`이 글자로 나간다(v0.79.2 배포 후 운영 크롤).
 * 줄 머리 기호(`- `·`#`)를 줄 단위로 인식해야 하므로 줄을 합치기 **전에** 적용한다.
 */
export function collapseToSingleLine(text: string): string {
    return stripSnapshotMarkdown(text)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ');
}

/**
 * 원문 필드 경로 전용 — 맨 앞 라벨·소제목 줄 제거 규칙 (2026-10-04 운영 크롤).
 *
 * 평이화 경로(`plain`)는 이 규칙을 타지 않는다. 원문은 LLM이 쓴 마크다운 필드라
 * 두 가지 머리말이 SERP 첫머리로 새어 나왔다:
 *  - 소제목 줄: `/AAPL`의 `"애플(AAPL) 일봉 종합 분석\n추세 방향과 강도\n분석 시점…"`이
 *    줄바꿈 제거로 `…종합 분석 추세 방향과 강도 분석 시점…`처럼 문장에 이어 붙었다.
 *  - 라벨: 차트 348개 중 55개가 `현재 상황:`·`요약:`으로 시작했다.
 */
const SENTENCE_TERMINATOR_PATTERN = /[!?。]|\.(?!\d)/;
// 소제목은 짧아야 한다 — 긴 줄은 종결부호가 없어도 본문 문장이다.
const HEADING_LINE_MAX_CODE_POINTS = 30;
// 단어 ≤ 2개(각 ≤ 12자) + 콜론 + **공백**. 콜론 뒤 공백을 요구해 `09:30`·`1:2`
// 같은 시각·비율 표기는 라벨로 보지 않는다. `.`은 단어에서 빼서 문장 중간의
// 콜론이 라벨로 오인되지 않게 한다(첫 종결부호 앞까지만 훑는다).
const LEADING_LABEL_PATTERN =
    /^[^\s.:：!?]{1,12}(?:\s[^\s.:：!?]{1,12})?\s*[:：]\s+/;

/**
 * 뒤에 줄이 더 있는, 종결부호 없는 짧은 줄을 소제목으로 보고 **앞에서부터** 떼어
 * 낸다. 첫 본문 줄에서 멈추며, 마지막 줄은 뒤따르는 줄이 없으므로 항상 남는다.
 * 소수점(`333.69`)은 종결부호가 아니다.
 */
function dropLeadingHeadingLines(lines: readonly string[]): string[] {
    const firstBodyIndex = lines.findIndex(
        (line, index) =>
            index === lines.length - 1 ||
            SENTENCE_TERMINATOR_PATTERN.test(line) ||
            [...line].length > HEADING_LINE_MAX_CODE_POINTS
    );
    return lines.slice(firstBodyIndex);
}

// 라벨 뒤가 숫자·통화 기호로 시작하면 콜론 앞은 라벨이 아니라 그 값의 주어다
// ("삼성전자 주가: 70,000원에", "RSI: 70이며") — 떼면 무엇의 값인지가 사라진다.
const VALUE_START_PATTERN = /^[\d$₩€¥£+\-−.]/;

/**
 * 맨 앞 라벨(`현재 상황: `, `요약: `)을 한 번 뗀다. 남은 문장이 값으로 시작하면
 * 콜론 앞이 주어라 떼지 않는다(2026-10-04 리뷰).
 */
function stripLeadingLabel(text: string): string {
    const match = LEADING_LABEL_PATTERN.exec(text);
    if (match === null) return text;
    const rest = text.slice(match[0].length);
    return VALUE_START_PATTERN.test(rest) ? text : rest.trim();
}

/**
 * 원문 필드를 한 줄로 합치되 머리말(소제목 줄, 맨 앞 라벨)을 뗀다. 떼고 나서
 * 비면 떼기 전 텍스트로 돌아간다.
 */
function collapseRawToSingleLine(text: string): string {
    const lines = stripSnapshotMarkdown(text)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    const unstripped = lines.join(' ');
    const body = dropLeadingHeadingLines(lines).join(' ');
    const stripped = stripLeadingLabel(body);
    return stripped.length > 0 ? stripped : unstripped;
}

// FIX 5 (audit): only accept a sentence-ending punctuation mark as a clamp
// point if it falls within this many code points of the hard cutoff — a
// boundary near the START of an over-length string would clamp far shorter
// than necessary, wasting most of the SERP snippet budget.
const SENTENCE_BOUNDARY_SEARCH_WINDOW = 40;

/**
 * 평이화 설명이 이보다 짧으면(주어 접두 제외, 코드포인트) 원문 필드로 폴백한다.
 *
 * 2026-09-17 운영 크롤: 차트 탭 420개 중 118개, 종합 탭 382개 중 104개의 설명이
 * 70자 미만이었다. 평이화 첫 문장이 "애플 주가는 지금 332.41달러입니다."(22자) 같은
 * 가격 한 줄이고 둘째 문장이 예산을 넘어 거기서 멈춘 것이다. 가격은 SERP에서 곧
 * 낡고, 두 탭의 평이화가 같은 문장으로 시작해 차트·종합 설명이 23쌍 중복됐다.
 * 원문 필드는 탭마다 다르고 내용이 있다.
 */
const PLAIN_DESCRIPTION_MIN_LENGTH = 40;
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
/**
 * 예산 안에 들어가는 **온전한 문장들**만 이어 붙인다. 하나도 못 넣으면 `null`.
 *
 * `clampAtSentenceBoundary`와 다르다. 그쪽은 하드 컷 지점에서 뒤로 40자만
 * 훑어 종결부호를 찾고, 못 찾으면 `…`로 자른다 — 첫 문장이 예산보다 길면
 * 무조건 잘린다. 이 함수는 자르지 않고 **넣을 수 있는 만큼만** 넣는다.
 *
 * 평이화 산문에 이 규칙이 필요한 이유: 평이화는 헤드라인 전용 필드가 없어
 * 본문 첫 문장부터 쓰게 되는데, 그게 원문의 `headlineKo`보다 길다(실측 40건,
 * overall 평균 94자 → 104자). 그대로 클램프하면 잘림이 2/40에서 11/40으로
 * 늘었다. 문장 단위로만 담으면 잘림이 구조적으로 0이 되고, 한 문장도 못 담는
 * 경우에만 호출자가 원문으로 폴백한다.
 */
export function takeWholeSentences(
    text: string,
    maxLength: number
): string | null {
    // 한국어 종결(`다.`)과 일반 종결부호를 모두 끊는다. CJK 종결부호는 공백을
    // 두지 않으므로 공백을 요구하지 않는다.
    const sentences = text
        .split(/(?<=다\.)\s*|(?<=[.!?。])\s+/)
        .map(part => part.trim())
        .filter(part => part.length > 0);

    let out = '';
    for (const sentence of sentences) {
        const next = out === '' ? sentence : `${out} ${sentence}`;
        if ([...next].length > maxLength) break;
        out = next;
    }
    return out === '' ? null : out;
}

export function clampAtSentenceBoundary(
    text: string,
    maxLength: number
): string {
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
 * `subject` is the short {@link buildTitleSubject} form (`애플(AAPL)`, `삼성전자(005930)`),
 * not the long display name (`애플, Apple Inc. (AAPL)`, up to 86 code points longer —
 * it ate the sentence budget and the first sentence no longer fit). It is followed by
 * the tab `label` and prefixed BEFORE clamping —
 * every templated builder
 * (`buildSymbol*SeoContent`) leads with the subject, and the target queries
 * ("AAPL 주가 분석") need it for the bolded query-term match in the SERP
 * snippet; raw prose alone was losing that. The title no longer promises a
 * forecast — "전망" was replaced with "분석" across every `titleCore` because a
 * YMYL page must not claim to predict prices; the query-term match now rides
 * on the "주가"/"시세" prefix, which is the half the query actually carries.
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
    /**
     * 프리웜이 함께 구워 둔 평이화 산문. 있으면 **이쪽을 먼저 시도한다.**
     *
     * SERP에 노출되는 두 줄이 여기서 나온다. 원문 필드는 전문 용어를 그대로
     * 싣는다(실측: `"기술적 이중천장 패턴과 … 재무 스코어카드 부진이…"`).
     * 평이화는 같은 내용을 일상어로 말하므로 클릭 판단에 쓸모가 있다.
     *
     * ⚠️ **문장 단위로만 담고, 한 문장도 안 들어가면 원문으로 떨어진다.**
     * 평이화에는 헤드라인 전용 필드가 없어 본문 첫 문장부터 쓰게 되는데 그게
     * 원문 `headlineKo`보다 길다(실측 40건, overall 평균 94자 → 104자). 그대로
     * 클램프하면 잘림이 2/40 → 11/40으로 늘었다. `takeWholeSentences`가 그
     * 교환을 없앤다 — 평이화를 쓰면 잘리지 않고, 잘릴 상황이면 아예 원문을 쓴다.
     */
    plain: string | null | undefined,
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고,
    // 그 탭만 조용히 한국어 설명으로 되돌아간다(`buildDisplayName`과 같은 규약).
    locale: Locale,
    /**
     * 탭 라벨(`주가 분석`·`펀더멘털`…). {@link symbolTabDescriptionLabel}이 준다.
     *
     * 프리픽스를 `{subject} {label} — `로 만들어 **같은 종목의 두 탭이 같은
     * description을 낼 수 없게** 한다(2026-09-20 네이버 중복 감지, `/SOXS`). 기본값을
     * 두지 않는 이유는 `locale`과 같다 — 빠뜨린 탭만 조용히 충돌 가능 상태로 남는다.
     */
    label: string
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

    const prefix = `${subject} ${label} — `;
    const budget = SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH - [...prefix].length;

    if (typeof plain === 'string' && plain.trim().length > 0) {
        const whole = takeWholeSentences(collapseToSingleLine(plain), budget);
        if (whole !== null && [...whole].length >= PLAIN_DESCRIPTION_MIN_LENGTH)
            return `${prefix}${whole}`;
        // 한 문장도 예산에 안 들어가거나, 들어간 게 가격 한 줄처럼 너무 짧다 —
        // 아래 원문 경로로 떨어진다(`PLAIN_DESCRIPTION_MIN_LENGTH`).
    }

    const raw = (content as Record<string, unknown>)[field];
    if (typeof raw !== 'string') return null;

    const singleLine = collapseRawToSingleLine(raw);
    if (singleLine.length === 0) return null;

    // 평이화 경로와 같은 규칙: 문장 단위로만 담는다. 첫 문장조차 예산에 안 들어갈 때만
    // 잘라 `…`를 붙인다 — 예전에는 하드 컷 지점에서 40자만 뒤로 훑어 종결부호를 찾았고,
    // 못 찾으면 문장 중간에서 끊겼다.
    const whole = takeWholeSentences(singleLine, budget);
    if (whole !== null) return `${prefix}${whole}`;
    return clampAtSentenceBoundary(
        `${prefix}${singleLine}`,
        SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH
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
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 기술적 신호`,
        `${ticker} 기술적 분석`,
        `${ticker} AI 분석`,
        `${displayName} 주가 분석`,
        `${displayName} 차트 분석`,
        `${ticker} chart analysis`,
        ...(koreanName
            ? [`${koreanName} 주가`, `${koreanName} 차트 분석`]
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
        /**
         * `images`를 **싣지 않는다** — Next는 `twitter.images`가 없으면 최종 `openGraph.images`
         * (= 탭의 `opengraph-image.tsx`)로 `twitter:image`를 채운다(`resolve-metadata`의
         * `postProcessMetadata`). 예전에는 탭마다 `twitter-image.tsx`가 og 이미지를 re-export해
         * 같은 이미지가 다른 URL로 두 번 렌더·저장됐다(2026-10 감사). 여기에 `images`를 넣으면
         * 그 자동 채움이 꺼진다.
         */
        twitter: buildTwitterMetadata({ title: fullTitle, description }),
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
//
// `name`은 **화면에 보이는 브레드크럼 텍스트와 같아야 한다**. 구글은 둘이 다르면
// 리치 결과에서 마크업을 무시한다. 종목 페이지의 가시 브레드크럼
// (`views/symbol/SymbolLayoutHeader`)은 `buildDisplayName` 결과를 색만 나눠
// 렌더하므로(예: `애플, Apple Inc. (AAPL)`), 종목 탭들은 티커가 아니라
// `displayName`을 넘긴다.
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

/**
 * FAQPage 구조화데이터를 만든다. 인자로 받은 배열은 반드시 `shared/ui/FaqSection`이
 * 같은 페이지에 렌더하는 배열과 **같은 상수**여야 한다.
 *
 * 구글은 FAQPage에 대응하는 질문·답변이 페이지에 실제로 보일 것을 요구한다. 마크업만
 * 있고 화면에 없으면 리치 결과 자격이 없을 뿐 아니라 수동 조치 사유다. 종목 탭 5개가
 * 오랫동안 그 상태였다 — 답변 텍스트를 JSON-LD 리터럴 안에만 두면 화면 카피를 고칠 때
 * 마크업이 따라오지 않는다. 배열 하나에서 두 표면을 만들면 갈릴 수가 없다.
 */
export function buildFaqJsonLd(
    items: readonly FaqItem[]
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
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
// 루트 레이아웃이 이미 `ROOT_KEYWORDS`를 선언한다 — 하위 페이지가 그걸 다시
// 펼치면 모든 페이지가 같은 일반 키워드 뭉치를 반복 선언하게 된다.
export const BACKTESTING_KEYWORDS = [
    '주식 AI 백테스팅',
    '기술적 분석 백테스팅',
    'AI 주식 분석 백테스트',
    '기술적 분석 백테스트 결과',
    'RSI 신호 백테스팅',
    'MACD 백테스팅',
    'AI 분석 백테스트 방법론',
    'Magnificent 7 분석',
    'AI 시나리오 사후 검증',
    '기술적 분석 백테스트 무료',
    '기술적 신호 사후 검증',
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
        ...(koreanName
            ? [
                  `${koreanName} 펀더멘털`,
                  `${koreanName} 재무 분석`,
                  `${koreanName} 밸류에이션`,
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
        ...(koreanName
            ? [
                  `${koreanName} 뉴스`,
                  `${koreanName} 호재`,
                  `${koreanName} 어닝`,
                  `${koreanName} 실적`,
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
        `${ticker} 차트`,
        `${ticker} 차트 분석`,
        `${ticker} 기술적 신호`,
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
        // 크립토 chart title tail은 주식과 동일 문구("차트·기술적 신호") —
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
 * "시세 분석"); stock/ETF/Index pages use `buildSymbolSeoContent` (equity-framed
 * copy: "주가 분석"). Both branches forward `koreanName` — `composeSymbolTitle`
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
    return buildSymbolTabSeoContent('technical', ticker, assetClass, t, {
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
    return buildSymbolTabSeoContent('news', ticker, assetClass, t, {
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
    return buildSymbolTabSeoContent('overall', ticker, assetClass, t, {
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
    return buildSymbolTabSeoContent('fear-greed', ticker, assetClass, t, {
        displayName: opts.displayName,
        koreanName: opts.koreanName ?? undefined,
        englishName: opts.englishName ?? undefined,
        locale: opts.locale,
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

/**
 * `/[symbol]/position` 탭의 SEO 콘텐츠 — `generateMetadata`(정상·차단 분기 모두)와 본문
 * JSON-LD의 **단일 소스**다. 둘로 갈라 두면 `<title>`과 `WebPage.name`이 조용히
 * 어긋난다(MISTAKES §2).
 *
 * 다른 탭과 달리 `composeSymbolTitle`을 쓰지 않는다 — 후킹 키워드(아파트/옥상/지하)가
 * displayName **앞**에 와야 한다. displayName은 종목마다 길이가 크게 달라(70자+도 있다)
 * 뒤에 붙이면 title/OG truncation과 description clamp에 메타포가 잘려 나간다.
 * displayName은 호출부가 `buildDisplayName(assetInfo, symbol, locale)`로 로케일에 맞게
 * 만들어 넘긴다 — 생략하면 티커다.
 */
export function buildSymbolPositionSeoContent(
    symbol: string,
    t: SeoTranslator,
    opts: BuildSymbolSeoOptions = {}
): SymbolSeoContent {
    const upper = symbol.toUpperCase();
    const displayName = opts.displayName ?? upper;
    const title = t('position.title', { v0: displayName });
    return {
        ticker: upper,
        title,
        fullTitle: `${title} | ${SITE_NAME}`,
        description: clampSeoDescription(
            t('position.description', { v0: displayName })
        ),
        url: `${SITE_URL}/${upper}/position`,
        keywords: buildSymbolPositionKeywords(upper, opts.koreanName),
    };
}

/** position 탭 키워드 — ★평단/수익률이 client-only인 개인화 surface라 다른 탭과 공유하지 않는다. */
function buildSymbolPositionKeywords(
    ticker: string,
    koreanName?: string
): string[] {
    return [
        `${ticker} 평단`,
        `${ticker} 평단 계산`,
        `${ticker} 내 위치`,
        `${ticker} 52주 범위`,
        ...(koreanName ? [`${koreanName} 평단`, `${koreanName} 내 위치`] : []),
        '평단 확인',
        '52주 최고가 최저가',
    ];
}
