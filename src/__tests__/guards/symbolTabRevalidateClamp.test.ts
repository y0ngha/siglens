import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as time from '@/shared/config/time';

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
 *    탭이 import하지 않는다. 페이지와 그 **한 단계 로컬 헬퍼**(`@/app/[locale]/[symbol]/…`·`./…`
 *    import — 예: `financialData.ts`, `symbolIndexabilityMetadata.ts`)까지 본다. 6h 읽기 함수
 *    이름(`getQuantizedBarsStatic` 등)은 주석을 뺀 코드에 나타나지도 않아야 한다.
 * 2. **TTL 인자** — 페이지가 import하는 `SECONDS_PER_*`(= `staticSymbolCache` TTL 인자)는 선언 이상이다.
 * 3. **목록** — 각 탭 렌더가 읽는 `unstable_cache`와 그 revalidate를 아래 표에 적고, 전부 선언 이상인지
 *    확인한다. 표가 소스와 따로 놀지 않도록 각 행의 `token`(읽기 함수·키 리터럴)이 그 페이지(또는
 *    레이아웃)와 한 단계 로컬 헬퍼의 코드에 실제로 나타나는지 단언한다 — 읽기를 지우거나 바꾸면
 *    표도 같이 고치게 된다. 호출 그래프 전체를 정적으로 따라가지는 못하므로, **새 정적 캐시 읽기를
 *    추가하면 표에도 적는다.**
 *
 * 탭 revalidate를 24h보다 길게 올리면 `SESSION_KEYED_CACHE_REVALIDATE_SECONDS`(세션 키 캐시)와
 * 24h 캐시들도 함께 올려야 한다 — 마지막 단언이 잡는다.
 */
const SYMBOL_DIR = path.resolve(__dirname, '../../app/[locale]/[symbol]');
const SRC_DIR = path.resolve(__dirname, '../..');

const readFile = (abs: string): string => readFileSync(abs, 'utf8');
const read = (rel: string): string => readFile(path.join(SYMBOL_DIR, rel));

const TAB_PAGES = [
    'page.tsx',
    'news/page.tsx',
    'overall/page.tsx',
    'fundamental/page.tsx',
    'financials/page.tsx',
    'congress/page.tsx',
    'options/page.tsx',
    'position/page.tsx',
    'fear-greed/page.tsx',
] as const;
type TabPage = (typeof TAB_PAGES)[number];

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

/** 소스가 import하는 모듈 지정자. 주석 속 이름은 세지 않는다. */
function importedModules(source: string): string[] {
    return [...source.matchAll(/^import[^;]*?from '([^']+)';/gm)].map(
        m => m[1]
    );
}

/** `@/app/[locale]/[symbol]/…`·`./…` import를 실제 파일로 푼다(.ts/.tsx). 못 찾으면 건너뛴다. */
function resolveLocalImport(specifier: string, fromAbs: string): string | null {
    const base = specifier.startsWith('@/app/[locale]/[symbol]/')
        ? path.join(SRC_DIR, specifier.slice('@/'.length))
        : specifier.startsWith('./')
          ? path.join(path.dirname(fromAbs), specifier)
          : null;
    if (base === null) return null;
    const found = ['.ts', '.tsx']
        .map(ext => `${base}${ext}`)
        .find(candidate => existsSync(candidate));
    return found ?? null;
}

/** 파일 자신 + 한 단계 로컬 헬퍼의 소스. */
function withLocalHelpers(rel: string): { rel: string; source: string }[] {
    const abs = path.join(SYMBOL_DIR, rel);
    const source = readFile(abs);
    const helpers = importedModules(source)
        .map(specifier => resolveLocalImport(specifier, abs))
        .filter((file): file is string => file !== null)
        .map(file => ({
            rel: path.relative(SYMBOL_DIR, file),
            source: readFile(file),
        }));
    return [{ rel, source }, ...helpers];
}

/** 6h 이하 revalidate의 `unstable_cache`를 두는 모듈 — 이 값보다 긴 선언의 탭·레이아웃은 import 금지. */
const SHORT_REVALIDATE_MODULES: Readonly<Record<string, number>> = {
    // getBarsStatic / getQuantizedBarsStatic / getSeedBarsStatic
    '@/entities/bars/lib/barsStaticCache': time.SECONDS_PER_QUARTER_DAY,
    // peekAnalysisStatic
    '@/entities/analysis/lib/peekAnalysisStaticCache':
        time.SECONDS_PER_QUARTER_DAY,
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
 * 페이지(또는 레이아웃)와 한 단계 로컬 헬퍼의 코드에서 찾는다.
 */
interface CacheRead {
    readonly token: string;
    readonly revalidate: number;
    /** `token`에서 실제 `unstable_cache`까지의 경로(사람용). */
    readonly via?: string;
}

/** 레이아웃(`[symbol]/layout.tsx`) — 9탭 전부에서 읽힌다. */
const LAYOUT_READS: readonly CacheRead[] = [
    {
        token: 'requireResolvableAsset',
        via: 'getAssetInfoResilient → getAssetInfoStatic',
        revalidate: time.SECONDS_PER_DAY,
    },
    {
        // 예전 getQuantizedBarsStatic(6h)을 대체한 헤더 공포·탐욕 칩
        token: 'getSymbolFearGreedChipStatic',
        revalidate: time.SESSION_KEYED_CACHE_REVALIDATE_SECONDS,
    },
    {
        token: 'RelatedSymbols',
        via: '피어 8종 getAssetInfoResilient → getAssetInfoStatic',
        revalidate: time.SECONDS_PER_DAY,
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

const PAGE_READS: Readonly<Record<TabPage, readonly PageRead[]>> = {
    'page.tsx': [
        {
            token: 'getQuantizedBarsStatic',
            revalidate: time.SECONDS_PER_QUARTER_DAY,
        },
        {
            token: 'getSeedBarsStatic',
            revalidate: time.SECONDS_PER_QUARTER_DAY,
        },
        {
            token: 'peekAnalysisStatic',
            revalidate: time.SECONDS_PER_QUARTER_DAY,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'news/page.tsx': [
        { token: 'getNewsList', revalidate: time.SECONDS_PER_HALF_DAY },
        { token: "'news:earnings'", revalidate: time.SECONDS_PER_HALF_DAY },
        { token: "'news:grades'", revalidate: time.SECONDS_PER_HALF_DAY },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'overall/page.tsx': [
        { token: 'getNewsList', revalidate: time.SECONDS_PER_HALF_DAY },
        { token: "'peek:overall'", revalidate: time.SECONDS_PER_HALF_DAY },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'fundamental/page.tsx': [
        { token: "'fundamental:profile'", revalidate: time.SECONDS_PER_DAY },
        { token: "'fundamental:metrics'", revalidate: time.SECONDS_PER_DAY },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'financials/page.tsx': [
        {
            token: 'getFinancialsSnapshot',
            via: 'financialData.ts → cacheNonEmpty(financials:*)',
            revalidate: time.SECONDS_PER_DAY,
        },
        {
            token: 'getProfileResilient',
            via: "staticSymbolCache('fundamental:profile')",
            revalidate: time.SECONDS_PER_DAY,
        },
        {
            token: 'isTabAllowedForSymbol',
            via: 'isCryptoSymbolStatic',
            revalidate: time.SECONDS_PER_DAY,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'congress/page.tsx': [
        { token: 'getProfileResilient', revalidate: time.SECONDS_PER_DAY },
        {
            token: 'isTabAllowedForSymbol',
            via: 'isCryptoSymbolStatic',
            revalidate: time.SECONDS_PER_DAY,
        },
        { token: 'getSeoSnapshotsStatic', revalidate: PAGE },
    ],
    'options/page.tsx': [
        { token: "'options:has'", revalidate: time.SECONDS_PER_HALF_DAY },
        { token: "'options:snapshot'", revalidate: time.SECONDS_PER_HALF_DAY },
        {
            token: 'isTabAllowedForSymbol',
            via: 'isCryptoSymbolStatic',
            revalidate: time.SECONDS_PER_DAY,
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
            via: 'isCryptoSymbolStatic',
            revalidate: time.SECONDS_PER_DAY,
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

describe('[symbol] 탭 revalidate clamp 가드', () => {
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
        expect(importedModules(read(LAYOUT))).toContain(
            '@/entities/bars/lib/sessionBarsStaticCache'
        );
    });

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
            for (const { token } of PAGE_READS[page]) {
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
                ...PAGE_READS[page].map(r => ({
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
