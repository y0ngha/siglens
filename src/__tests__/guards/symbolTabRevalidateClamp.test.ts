import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PEEK_ANALYSIS_STATIC_REVALIDATE_SECONDS } from '@/entities/analysis/server/peekAnalysisStaticCache';
import { BARS_STATIC_REVALIDATE_SECONDS } from '@/entities/bars/server/barsStaticCache';
import { EARNINGS_HINT_REVALIDATE_SECONDS } from '@/entities/analyst-views/server/loadEarningsHint';
import { FINANCIALS_SNAPSHOT_REVALIDATE_SECONDS } from '@/entities/financials-statements/server/getFinancialsSnapshot';
import {
    PRICE_TARGET_REVALIDATE_SECONDS,
    FUNDAMENTAL_FACTS_REVALIDATE_SECONDS,
} from '@/entities/fundamental-facts/server/getFundamentalFacts';
import { INVESTOR_FLOWS_READINESS_REVALIDATE_SECONDS } from '@/entities/investor-flows/server/getInvestorFlowsPipelineReadiness';
import { INVESTOR_FLOWS_SNAPSHOT_REVALIDATE_SECONDS } from '@/entities/investor-flows/server/getInvestorFlowsSnapshot';
import { DILUTION_BADGE_REVALIDATE_SECONDS } from '@/entities/investor-flows/server/getRecentDilutionEvent';
import { KR_VALUATION_REVALIDATE_SECONDS } from '@/entities/kr-valuation/server/loadPageKrValuation';
import { ASSET_INFO_STATIC_REVALIDATE_SECONDS } from '@/entities/ticker/server/getAssetInfoStatic';
import { CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS } from '@/entities/ticker/server/isCryptoSymbolStatic';
import { PROFILE_REVALIDATE_SECONDS } from '@/entities/ticker/server/getProfileResilient';
import { GRADES_CONSENSUS_REVALIDATE_SECONDS } from '@/shared/api/fmp/loadPageGradesConsensus';
import * as time from '@/shared/config/time';
import { SYMBOL_SUB_TAB_KEYS } from '@/views/symbol/utils/symbolTabsConfig';

import { NEWS_LIST_REVALIDATE_SECONDS } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import { FUNDAMENTAL_SECTION_REVALIDATE_SECONDS } from '@/app/[locale]/[symbol]/fundamental/_components/FundamentalSections';
import { NEWS_SECTION_REVALIDATE_SECONDS } from '@/app/[locale]/[symbol]/news/_components/NewsSections';
import { OPTIONS_REVALIDATE_SECONDS } from '@/app/[locale]/[symbol]/options/_lib/optionsData';
import { OVERALL_PEEK_REVALIDATE_SECONDS } from '@/app/[locale]/[symbol]/overall/_lib/overallPeek';

import { blankComments } from './support/sourceScan';

/**
 * **`[symbol]` 탭이 읽는 `unstable_cache`의 revalidate는 그 탭의 선언값 이상이어야 한다.**
 *
 * Next 16.3의 `unstable_cache`는 렌더(레이아웃 + 페이지 + `generateMetadata`) 중 읽힌 모든
 * 엔트리 — HIT·MISS 무관 — 의 `revalidate` 최솟값으로 라우트 revalidate를 낮춘다
 * (`unstable-cache.js`의 `prerender-legacy` 분기, `unstableCacheRevalidateLowering.test.ts`가
 * 분기 존재를 고정). 그래서 페이지의 `export const revalidate` 리터럴은 **상한**일 뿐이고,
 * 짧은 캐시 하나가 섞이면 조용히 그 값으로 재생성된다. 2026-10 운영 실측:
 *
 * | 경로 | 선언 | 실측 s-maxage | 원인 |
 * |---|---|---|---|
 * | `/AAPL/fundamental`·`financials`·`congress` | 86400 | 21600 | 레이아웃 헤더 칩의 6h 봉 캐시 |
 * | `/AAPL/news`·`options`·`overall` | 43200 | 21600 | 〃 |
 * | `/AAPL/fear-greed` | 86400 | 3600 | 〃 + 시장 공포·탐욕 허브 1h 캐시 |
 *
 * 레이아웃은 9탭 공유라 한 번의 짧은 읽기가 전 탭을 끌어내린다. 이 가드는 세 가지를 고정한다.
 *
 * 1. **구조** — 6h 캐시 모듈(봉·AI peek)과 시장 허브 1h 캐시 모듈을 레이아웃과 6h보다 긴 선언의
 *    탭이 import하지 않는다. 페이지와 거기서 닿는 **`[symbol]` 안 로컬 헬퍼 전부**
 *    (`@/app/[locale]/[symbol]/…`·상대 import를 전이적으로 — 예: `financialData.ts`,
 *    `news/_components/NewsSections.tsx` → `newsData.ts`)를 본다. 6h 읽기 함수 이름
 *    (`getQuantizedBarsStatic` 등)은 주석을 뺀 코드에 나타나지도 않아야 한다.
 * 2. **TTL 인자** — 페이지가 import하는 `SECONDS_PER_*`(= `staticSymbolCache` TTL 인자)는 선언 이상이다.
 * 3. **목록** — 각 탭 렌더가 읽는 `unstable_cache`와 그 revalidate를 아래 표에 적고, 전부 선언 이상인지
 *    확인한다. 표가 소스와 따로 놀지 않도록 각 행의 `token`(읽기 함수·키 리터럴)이 그 페이지(또는
 *    레이아웃)와 로컬 헬퍼의 코드에 실제로 나타나는지 단언한다 — 읽기를 지우거나 바꾸면
 *    표도 같이 고치게 된다. 행의 revalidate는 읽기 모듈이 내보내는 `*_REVALIDATE_SECONDS`를 가리키므로
 *    읽기 쪽 TTL을 바꾸면 표가 따라온다. 호출 그래프 전체를 정적으로 따라가지는 못하므로, **새 정적
 *    캐시 읽기를 추가하면 표에도 적는다**(모듈이 상수를 내보내고 호출이 그것을 쓰게 한다).
 *
 * 탭 revalidate를 24h보다 길게 올리면 `SESSION_KEYED_CACHE_REVALIDATE_SECONDS`(세션 키 캐시)와
 * 24h 캐시들도 함께 올려야 한다 — 마지막 단언이 잡는다.
 */
const SYMBOL_DIR = path.resolve(__dirname, '../../app/[locale]/[symbol]');
const SRC_DIR = path.resolve(__dirname, '../..');

const readFile = (abs: string): string => readFileSync(abs, 'utf8');
const read = (rel: string): string => readFile(path.join(SYMBOL_DIR, rel));

/**
 * 검사할 탭 페이지 — 차트 탭(`page.tsx`) + 탭 설정의 하위 탭 키마다 `<key>/page.tsx`. 손으로 적지 않고
 * `SYMBOL_SUB_TAB_KEYS`(탭 바의 단일 소스)에서 유도해, 탭이 늘면 이 가드도 그 탭을 검사한다.
 */
const TAB_PAGES: readonly string[] = [
    'page.tsx',
    ...SYMBOL_SUB_TAB_KEYS.map(key => `${key}/page.tsx`),
];

/** 디렉터리에 실제로 있는 하위 탭 페이지(`[symbol]/<dir>/page.tsx`). */
function subTabPagesOnDisk(): string[] {
    return readdirSync(SYMBOL_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
        .filter(entry => entry.name !== '__tests__')
        .map(entry => `${entry.name}/page.tsx`)
        .filter(rel => existsSync(path.join(SYMBOL_DIR, rel)))
        .sort();
}

/** `export const revalidate = N` 리터럴(라우트 segment config는 리터럴이어야 한다 — app/CLAUDE.md). */
function declaredRevalidate(source: string): number {
    const match = /export const revalidate = (\d+);/.exec(source);
    if (match === null) throw new Error('revalidate literal not found');
    return Number(match[1]);
}

/** 주석을 지운 코드. 문자열 속 `//`(URL)까지 지울 수 있지만 식별자 검색에는 무해하다. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** 모듈 간선 종류별 지정자 패턴 — 정적 import·재export·부수효과 import·동적 `import()`. */
const MODULE_EDGE_PATTERNS: readonly RegExp[] = [
    /^import\s[^;]*?from\s+'([^']+)';/gm,
    /^export\s[^;]*?from\s+'([^']+)';/gm,
    /^import\s+'([^']+)';/gm,
    /\bimport\(\s*'([^']+)'\s*\)/g,
];

/**
 * 소스가 의존하는 모듈 지정자 — 정적 import뿐 아니라 `export … from` 재export, 부수효과 `import '…'`,
 * 동적 `import('…')`까지 센다(어느 간선이든 그 모듈의 `unstable_cache`가 렌더에서 읽힐 수 있다).
 * 주석을 먼저 비워(`blankComments`) 주석 속 이름은 세지 않는다.
 */
function importedModules(source: string): string[] {
    const code = blankComments(source);
    return MODULE_EDGE_PATTERNS.flatMap(pattern =>
        [...code.matchAll(pattern)].map(m => m[1] ?? '')
    );
}

/**
 * `@/app/[locale]/[symbol]/…`·상대 경로(`./…`·`../…`) import를 실제 파일로 푼다(.ts/.tsx). `[symbol]`
 * 슬라이스 밖이거나 못 찾으면 건너뛴다.
 */
function resolveLocalImport(specifier: string, fromAbs: string): string | null {
    const base = specifier.startsWith('@/app/[locale]/[symbol]/')
        ? path.join(SRC_DIR, specifier.slice('@/'.length))
        : specifier.startsWith('.')
          ? path.join(path.dirname(fromAbs), specifier)
          : null;
    if (base === null) return null;
    if (!base.startsWith(`${SYMBOL_DIR}${path.sep}`)) return null;
    const found = ['.ts', '.tsx']
        .map(ext => `${base}${ext}`)
        .find(candidate => existsSync(candidate));
    return found ?? null;
}

/**
 * 파일 자신 + 거기서 닿는 `[symbol]` 슬라이스 안 로컬 헬퍼 전부(전이적). 라우트 파일이 섹션·로더를
 * `_components/`·`_lib/`로 내리면 캐시 읽기가 두 단계 이상 아래로 내려가므로 깊이를 제한하지 않는다.
 * 방문 집합으로 순환을 끊는다.
 */
function withLocalHelpers(rel: string): { rel: string; source: string }[] {
    const visited = new Set<string>();
    const visit = (abs: string): { rel: string; source: string }[] => {
        if (visited.has(abs)) return [];
        visited.add(abs);
        const source = readFile(abs);
        const children = importedModules(source)
            .map(specifier => resolveLocalImport(specifier, abs))
            .filter((file): file is string => file !== null)
            .flatMap(visit);
        return [{ rel: path.relative(SYMBOL_DIR, abs), source }, ...children];
    };
    return visit(path.join(SYMBOL_DIR, rel));
}

/** 6h 이하 revalidate의 `unstable_cache`를 두는 모듈 — 이 값보다 긴 선언의 탭·레이아웃은 import 금지. */
const SHORT_REVALIDATE_MODULES: Readonly<Record<string, number>> = {
    // getBarsStatic / getQuantizedBarsStatic / getSeedBarsStatic
    '@/entities/bars/server/barsStaticCache': BARS_STATIC_REVALIDATE_SECONDS,
    // peekAnalysisStatic
    '@/entities/analysis/server/peekAnalysisStaticCache':
        PEEK_ANALYSIS_STATIC_REVALIDATE_SECONDS,
    // 시장 공포·탐욕 허브 캐시(1h). 종목 탭은 `marketFearGreedReading`(세션 키 24h)으로 읽는다.
    '@/entities/market-fear-greed/api/marketFearGreedStaticCache':
        time.SECONDS_PER_HOUR,
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache':
        time.SECONDS_PER_HOUR,
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache':
        time.SECONDS_PER_HOUR,
};

/** 6h revalidate 캐시를 읽는 함수 이름 — 6h보다 긴 선언의 탭·레이아웃 코드에 나타나면 안 된다. */
const SHORT_REVALIDATE_READERS = [
    'getBarsStatic',
    'getQuantizedBarsStatic',
    'getSeedBarsStatic',
    'peekAnalysisStatic',
] as const;

/**
 * 표의 한 행. `token`은 그 읽기가 소스에 있다는 증거(읽기 함수 이름 또는 캐시 키 리터럴)다 —
 * 페이지(또는 레이아웃)와 로컬 헬퍼(전이적)의 코드에서 찾는다.
 *
 * `revalidate`는 **읽기 모듈이 내보내는 `*_REVALIDATE_SECONDS`를 그대로 가리킨다.** 값을 표에
 * 옮겨 적으면 읽기 쪽 TTL을 바꿔도 표는 옛 값으로 남아 가드가 초록이다. 상수를 참조하면 읽기와
 * 표가 같은 값을 본다. 읽기 호출은 같은 상수를 `revalidate` 인자로 쓴다.
 */
interface CacheRead {
    readonly token: string;
    readonly revalidate: number;
}

/** 레이아웃(`[symbol]/layout.tsx`) — 9탭 전부에서 읽힌다. */
const LAYOUT_READS: readonly CacheRead[] = [
    // requireResolvableAsset → getAssetInfoResilient → getAssetInfoStatic
    {
        token: 'requireResolvableAsset',
        revalidate: ASSET_INFO_STATIC_REVALIDATE_SECONDS,
    },
    // 예전 getQuantizedBarsStatic(6h)을 대체한 헤더 공포·탐욕 칩
    {
        token: 'getSymbolFearGreedChipStatic',
        revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
    },
    // 피어 8종 getAssetInfoResilient → getAssetInfoStatic
    {
        token: 'RelatedSymbols',
        revalidate: ASSET_INFO_STATIC_REVALIDATE_SECONDS,
    },
];

/**
 * `revalidate`를 인자로 받는 읽기는 페이지가 자기 선언값을 그대로 넘긴다 —
 * `getSeoSnapshotsStatic(…, revalidate, …)`(본문·`getBlockedSymbolMetadata`·
 * `symbolSnapshotDescription`). 그래서 표에는 `PAGE`로 적는다.
 */
const PAGE = Symbol('page revalidate');
type PageRead = Omit<CacheRead, 'revalidate'> & {
    readonly revalidate: number | typeof PAGE;
};

const PAGE_READS: Readonly<Record<string, readonly PageRead[]>> = {
    'page.tsx': [
        {
            token: 'getQuantizedBarsStatic',
            revalidate: BARS_STATIC_REVALIDATE_SECONDS,
        },
        {
            token: 'getSeedBarsStatic',
            revalidate: BARS_STATIC_REVALIDATE_SECONDS,
        },
        {
            token: 'peekAnalysisStatic',
            revalidate: PEEK_ANALYSIS_STATIC_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
        // 헤더 증자·희석 배지(미국 개별 주식만)
        {
            token: 'getRecentDilutionEvent',
            revalidate: DILUTION_BADGE_REVALIDATE_SECONDS,
        },
    ],
    'news/page.tsx': [
        // 알려진 예외: 공시 섹션의 'news:company-filings'(NewsSections.tsx, 1시간 loadBoundedOptional)는
        // 이 표에 없다. 제목을 못 읽은 공시 목록이 오래 남지 않도록 일부러 짧게 둔 값이라 탭 선언(12시간)보다
        // 낮고, 행을 넣으면 이 가드가 실패한다. 탭 전체가 1시간마다 다시 만들어지는 비용을 재고 구조를 정하면
        // 이 주석을 지우고 행을 넣는다.
        { token: 'getNewsList', revalidate: NEWS_LIST_REVALIDATE_SECONDS },
        {
            token: "'news:earnings'",
            revalidate: NEWS_SECTION_REVALIDATE_SECONDS,
        },
        { token: "'news:grades'", revalidate: NEWS_SECTION_REVALIDATE_SECONDS },
        // 실적 카드의 Yahoo 힌트(loadEarningsHintBounded)
        {
            token: 'loadEarningsHintBounded',
            revalidate: EARNINGS_HINT_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'overall/page.tsx': [
        { token: 'getNewsList', revalidate: NEWS_LIST_REVALIDATE_SECONDS },
        {
            token: "'peek:overall'",
            revalidate: OVERALL_PEEK_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'fundamental/page.tsx': [
        {
            token: "'fundamental:profile'",
            revalidate: FUNDAMENTAL_SECTION_REVALIDATE_SECONDS,
        },
        {
            token: "'fundamental:metrics-v3'",
            revalidate: FUNDAMENTAL_SECTION_REVALIDATE_SECONDS,
        },
        // 일시적 대체 값은 캐시하지 않고 섹션이 이 렌더의 revalidate를 낮춘다
        {
            token: 'loadPageKrValuation',
            revalidate: KR_VALUATION_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
        // getFundamentalFacts가 한 렌더에서 읽는 캐시 전부 — 실적, 수급 점수표(flows 탭과 같은 키), 재무,
        // 목표가, 등급, Yahoo 힌트. 읽기마다 자기 상수를 가리킨다.
        {
            token: 'getFundamentalFacts',
            revalidate: FUNDAMENTAL_FACTS_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: INVESTOR_FLOWS_SNAPSHOT_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: INVESTOR_FLOWS_READINESS_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: FINANCIALS_SNAPSHOT_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: PRICE_TARGET_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: PRICE_TARGET_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: GRADES_CONSENSUS_REVALIDATE_SECONDS,
        },
        {
            token: 'getFundamentalFacts',
            revalidate: EARNINGS_HINT_REVALIDATE_SECONDS,
        },
    ],
    'financials/page.tsx': [
        {
            token: 'getFinancialsSnapshot',
            revalidate: FINANCIALS_SNAPSHOT_REVALIDATE_SECONDS,
        },
        {
            token: 'getProfileResilient',
            revalidate: PROFILE_REVALIDATE_SECONDS,
        },
        {
            token: 'isTabAllowedForSymbol',
            revalidate: CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'congress/page.tsx': [
        {
            token: 'getProfileResilient',
            revalidate: PROFILE_REVALIDATE_SECONDS,
        },
        {
            token: 'isTabAllowedForSymbol',
            revalidate: CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'flows/page.tsx': [
        // 점수표의 숏스퀴즈 입력 봉(getInvestorFlowsEvaluationOptions → getSessionBarsStatic, 세션 키)
        {
            token: 'getInvestorFlowsScorecard',
            revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
        },
        // getInvestorFlowsResilient → 스냅샷 + 파이프라인 준비 상태. FMP 일시 오류로 degrade된
        // 스냅샷만 별도 키의 10분 엔트리로 읽혀 그 렌더를 일부러 낮춘다
        // (INVESTOR_FLOWS_DEGRADED_SNAPSHOT_TTL_SECONDS).
        {
            token: 'getInvestorFlowsScorecard',
            revalidate: INVESTOR_FLOWS_SNAPSHOT_REVALIDATE_SECONDS,
        },
        {
            token: 'getInvestorFlowsScorecard',
            revalidate: INVESTOR_FLOWS_READINESS_REVALIDATE_SECONDS,
        },
        {
            token: 'getProfileResilient',
            revalidate: PROFILE_REVALIDATE_SECONDS,
        },
        {
            token: 'isTabAllowedForSymbol',
            revalidate: CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS,
        },
    ],
    'options/page.tsx': [
        { token: "'options:has'", revalidate: OPTIONS_REVALIDATE_SECONDS },
        {
            token: "'options:snapshot-v2'",
            revalidate: OPTIONS_REVALIDATE_SECONDS,
        },
        {
            token: 'isTabAllowedForSymbol',
            revalidate: CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'position/page.tsx': [
        // 예전 getQuantizedBarsStatic(6h)이 이 탭(12h)을 6h로 clamp했다.
        {
            token: 'getSessionBarsStatic',
            revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
        },
        {
            token: 'isTabAllowedForSymbol',
            revalidate: CRYPTO_MEMBERSHIP_REVALIDATE_SECONDS,
        },
    ],
    'fear-greed/page.tsx': [
        // 본문·generateMetadata — 예전 getQuantizedBarsStatic(6h)
        {
            token: 'getSessionBarsStatic',
            revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
        },
        // 예전 getMarketFearGreed*Static(1h) 직접 읽기
        {
            token: 'getMarketFearGreedReading',
            revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
        },
    ],
};

const LAYOUT = 'layout.tsx';

describe('importedModules', () => {
    it.each([
        ["import { a } from '@/x';", ['@/x']],
        ["import type { T } from '@/t';", ['@/t']],
        ["export { a } from './a';", ['./a']],
        ["export * from './star';", ['./star']],
        ["import './side-effect';", ['./side-effect']],
        ["const m = await import('@/dynamic');", ['@/dynamic']],
        ["// import { a } from '@/commented';\n/* import('@/blocked') */", []],
    ] as const)('%s → %j', (source, specifiers) => {
        expect(importedModules(source)).toEqual(specifiers);
    });
});

describe('[symbol] 탭 revalidate clamp 가드', () => {
    it('탭 키마다 페이지가 있고, 탭 키에 없는 탭 페이지는 없다', () => {
        expect(subTabPagesOnDisk()).toEqual(
            SYMBOL_SUB_TAB_KEYS.map(key => `${key}/page.tsx`).sort()
        );
        expect(existsSync(path.join(SYMBOL_DIR, 'page.tsx'))).toBe(true);
    });

    it('읽기 표가 모든 탭 페이지를 덮는다(새 탭은 표에도 적는다)', () => {
        expect(Object.keys(PAGE_READS).sort()).toEqual([...TAB_PAGES].sort());
    });

    it('레이아웃(+로컬 헬퍼)은 짧은 revalidate 캐시 모듈을 import하지도, 6h 읽기 함수를 부르지도 않는다 (9탭 공유)', () => {
        for (const { rel, source } of withLocalHelpers(LAYOUT)) {
            const imports = importedModules(source);
            for (const specifier of Object.keys(SHORT_REVALIDATE_MODULES)) {
                expect(imports, `${rel} imports ${specifier}`).not.toContain(
                    specifier
                );
            }
            const code = stripComments(source);
            for (const reader of SHORT_REVALIDATE_READERS) {
                expect(
                    new RegExp(`\\b${reader}\\b`).test(code),
                    `${rel} calls ${reader}`
                ).toBe(false);
            }
        }
        expect(
            withLocalHelpers(LAYOUT).flatMap(({ source }) =>
                importedModules(source)
            )
        ).toContain('@/entities/bars/server/sessionBarsStaticCache');
    });

    it.each([
        ['news/page.tsx', 'news/newsData.ts'],
        ['fundamental/page.tsx', 'fundamental/fundamentalData.ts'],
        ['fundamental/page.tsx', 'fundamental/profileDescription.ts'],
        ['layout.tsx', '_components/SymbolLayoutChrome.tsx'],
    ])(
        '%s의 스캔 대상에 두 단계 아래 헬퍼 %s가 들어간다(전이 탐색)',
        (entry, helper) => {
            expect(withLocalHelpers(entry).map(({ rel }) => rel)).toContain(
                helper
            );
        }
    );

    it.each(TAB_PAGES)(
        '%s (+로컬 헬퍼) — 선언보다 짧은 revalidate 캐시 모듈·읽기 함수를 쓰지 않는다',
        page => {
            const declared = declaredRevalidate(read(page));
            for (const { rel, source } of withLocalHelpers(page)) {
                const imports = importedModules(source);
                for (const [specifier, seconds] of Object.entries(
                    SHORT_REVALIDATE_MODULES
                )) {
                    if (seconds < declared) {
                        expect(
                            imports,
                            `${rel} imports ${specifier}`
                        ).not.toContain(specifier);
                    }
                }
                if (time.SECONDS_PER_QUARTER_DAY < declared) {
                    const code = stripComments(source);
                    for (const reader of SHORT_REVALIDATE_READERS) {
                        expect(
                            new RegExp(`\\b${reader}\\b`).test(code),
                            `${rel} calls ${reader}`
                        ).toBe(false);
                    }
                }
            }
        }
    );

    it.each(TAB_PAGES)(
        '%s — 페이지가 쓰는 SECONDS_PER_* 캐시 TTL은 선언 이상이다',
        page => {
            const source = read(page);
            const declared = declaredRevalidate(source);
            const timeImport =
                /import \{([^}]*)\} from '@\/shared\/config\/time';/.exec(
                    source
                );
            const names = (timeImport?.[1] ?? '')
                .split(',')
                .map(name => name.trim())
                .filter(name => name.startsWith('SECONDS_PER_'));
            for (const name of names) {
                const seconds = (time as Record<string, unknown>)[name];
                expect(typeof seconds, name).toBe('number');
                expect(
                    seconds as number,
                    `${page}: ${name}`
                ).toBeGreaterThanOrEqual(declared);
            }
        }
    );

    it('표의 레이아웃 읽기가 레이아웃 코드에 실제로 있다 (표-소스 동기화)', () => {
        const code = withLocalHelpers(LAYOUT)
            .map(({ source }) => stripComments(source))
            .join('\n');
        for (const { token } of LAYOUT_READS) {
            expect(code.includes(token), `layout: ${token}`).toBe(true);
        }
    });

    it.each(TAB_PAGES)(
        '%s — 표의 읽기가 페이지(+로컬 헬퍼) 코드에 실제로 있다 (표-소스 동기화)',
        page => {
            const code = withLocalHelpers(page)
                .map(({ source }) => stripComments(source))
                .join('\n');
            for (const { token } of PAGE_READS[page] ?? []) {
                expect(code.includes(token), `${page}: ${token}`).toBe(true);
            }
        }
    );

    it.each(TAB_PAGES)(
        '%s — 렌더가 읽는 unstable_cache revalidate(레이아웃 + 페이지)가 전부 선언 이상이다',
        page => {
            const declared = declaredRevalidate(read(page));
            const reads: CacheRead[] = [
                ...LAYOUT_READS,
                ...(PAGE_READS[page] ?? []).map(r => ({
                    token: r.token,
                    revalidate: r.revalidate === PAGE ? declared : r.revalidate,
                })),
            ];
            for (const { token, revalidate } of reads) {
                expect(revalidate, `${page}: ${token}`).toBeGreaterThanOrEqual(
                    declared
                );
            }
        }
    );

    it('세션 키 캐시 revalidate는 가장 긴 탭 선언 이상이다', () => {
        const longest = Math.max(
            ...TAB_PAGES.map(page => declaredRevalidate(read(page)))
        );
        expect(
            time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS
        ).toBeGreaterThanOrEqual(longest);
    });
});
