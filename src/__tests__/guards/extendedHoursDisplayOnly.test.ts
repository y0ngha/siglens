import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **프리·애프터마켓 가격은 표시 전용이다** 가드.
 *
 * 확장 세션 체결가(FMP `aftermarket-trade`)는 `/quote`·봉·지표와 다른 계통의 값이다.
 * 정규장 시세는 마감 후에도 종가로 남아야 하고(일봉의 live tail, 분석의 현재가, SEO 스냅샷),
 * 확장 세션 가격이 그 경로로 새면 종가가 아닌 값이 봉·지표·분석 입력·색인되는 HTML에 박힌다.
 * 그래서 이 값을 아는 파일을 **허용 목록으로** 고정한다 — 목록 밖 파일이 이 심볼·엔드포인트·
 * 캐시 키·모듈을 건드리면 실패한다. 새 소비자가 정말 필요하면 이 목록을 고치는 리뷰가 곧
 * "표시 전용인가"를 묻는 자리다.
 *
 * 판정은 주석을 지운 소스에서 한다(TESTING.md#TE-42): 허용 목록 밖 파일이 이 이름을 주석으로
 * 언급하는 것은 위반이 아니다.
 */
const SRC_DIR = path.resolve(__dirname, '../..');

const TEST_FILE = /(^|\/)__tests__\/|\.test\.tsx?$/;

/** 확장 세션 데이터의 정의·조회 쪽 이름(엔드포인트, 어댑터 메서드, 파서, 타입). */
const PROVIDER_TOKENS: readonly RegExp[] = [
    /aftermarket-(trade|quote)/,
    /getExtendedHoursTrade/,
    /parseAftermarketTrade/,
    /ExtendedHoursTrade\b/,
];

/** 확장 세션 전용 Redis 키 계통. */
const CACHE_KEY_TOKEN = /quote:ext\b/;

/** 확장 세션 entity를 가리키는 import. */
const ENTITY_IMPORT =
    /from\s+['"](@\/entities\/extended-hours\/|\.\.?\/[^'"]*extended-hours\/)/;

const PROVIDER_TOKEN_ALLOWED = [
    'shared/api/fmp/FmpMarketProvider.ts',
    'shared/api/market/marketProvider.types.ts',
];
const ENTITY_DIR = 'entities/extended-hours/';
const WIDGET_DIR = 'widgets/extended-hours/';

interface SourceFile {
    rel: string;
    code: string;
}

function productionSources(): SourceFile[] {
    return sourceFiles(SRC_DIR)
        .map(abs => path.relative(SRC_DIR, abs).split(path.sep).join('/'))
        .filter(rel => !TEST_FILE.test(rel))
        .map(rel => ({
            rel,
            code: blankComments(readFileSync(path.join(SRC_DIR, rel), 'utf8')),
        }));
}

const startsWithAny = (rel: string, prefixes: readonly string[]): boolean =>
    prefixes.some(prefix => rel.startsWith(prefix));

function providerTokenOffenders(files: SourceFile[]): string[] {
    return files
        .filter(
            ({ rel, code }) =>
                !PROVIDER_TOKEN_ALLOWED.includes(rel) &&
                !rel.startsWith(ENTITY_DIR) &&
                PROVIDER_TOKENS.some(token => token.test(code))
        )
        .map(({ rel }) => rel);
}

function cacheKeyOffenders(files: SourceFile[]): string[] {
    return files
        .filter(
            ({ rel, code }) =>
                rel !== `${ENTITY_DIR}api.ts` && CACHE_KEY_TOKEN.test(code)
        )
        .map(({ rel }) => rel);
}

function entityImportOffenders(files: SourceFile[]): string[] {
    return files
        .filter(
            ({ rel, code }) =>
                !startsWithAny(rel, [ENTITY_DIR, WIDGET_DIR]) &&
                ENTITY_IMPORT.test(code)
        )
        .map(({ rel }) => rel);
}

describe('프리·애프터마켓 가격은 표시 전용이다', () => {
    const files = productionSources();

    it('스캔 대상이 비어 있지 않고, 보호하려는 계통의 파일이 실제로 들어 있다', () => {
        const rels = files.map(f => f.rel);
        expect(rels).toContain('shared/api/market/CachedMarketDataProvider.ts');
        expect(rels).toContain('shared/api/fmp/FmpMarketProvider.ts');
        expect(rels.some(r => r.startsWith('entities/bars/'))).toBe(true);
        expect(rels.some(r => r.startsWith('entities/analysis/'))).toBe(true);
        expect(rels.some(r => r.startsWith('entities/seo-snapshot/'))).toBe(
            true
        );
        expect(existsSync(path.join(SRC_DIR, ENTITY_DIR, 'api.ts'))).toBe(true);
    });

    it(
        'aftermarket 엔드포인트·어댑터 메서드·타입은 FMP 어댑터와 확장 시세 entity 밖에 없다(봉·todayBar·지표·분석·SEO 경로 포함)',
        () => {
            expect(providerTokenOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '`quote:ext` 캐시 키는 확장 시세 api.ts 한 곳에만 있다(기존 quote·bars 키를 바꾸지 않는다)',
        () => {
            expect(cacheKeyOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '확장 시세 entity는 자기 슬라이스와 전용 위젯만 import한다',
        () => {
            expect(entityImportOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it('종목 페이지의 SEO·봉·분석 경로가 확장 시세 위젯을 직접 부르지 않는다(위젯은 뷰의 클라이언트 헤더 행에서만 쓰인다)', () => {
        const users = files
            .filter(({ code }) => /extended-hours\/ui\//.test(code))
            .map(({ rel }) => rel)
            .filter(rel => !rel.startsWith(WIDGET_DIR));
        expect(users).toEqual(['views/symbol/SymbolPageClient.tsx']);
    });

    describe('검출기 자체', () => {
        const probe = (rel: string, code: string): SourceFile => ({
            rel,
            code: blankComments(code),
        });

        it('봉 캐시가 aftermarket 엔드포인트를 부르면 잡는다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'shared/api/market/CachedMarketDataProvider.ts',
                        "const t = await fmpGet('aftermarket-trade', { symbol });"
                    ),
                ])
            ).toEqual(['shared/api/market/CachedMarketDataProvider.ts']);
        });

        it('분석 경로가 어댑터 메서드나 타입을 쓰면 잡는다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'entities/analysis/lib/x.ts',
                        'const t = await provider.getExtendedHoursTrade(s);'
                    ),
                    probe(
                        'entities/seo-snapshot/y.ts',
                        "import type { ExtendedHoursTrade } from '@/shared/api/market/marketProvider.types';"
                    ),
                ])
            ).toEqual([
                'entities/analysis/lib/x.ts',
                'entities/seo-snapshot/y.ts',
            ]);
        });

        it('다른 곳이 quote:ext 키를 읽거나 쓰면 잡는다', () => {
            expect(
                cacheKeyOffenders([
                    probe(
                        'entities/bars/lib/z.ts',
                        'const key = `quote:ext:${s}`;'
                    ),
                ])
            ).toEqual(['entities/bars/lib/z.ts']);
        });

        it('봉 entity가 확장 시세 entity를 import하면 잡는다', () => {
            expect(
                entityImportOffenders([
                    probe(
                        'entities/bars/server/loadBarsData.ts',
                        "import { x } from '@/entities/extended-hours/lib/buildExtendedQuote';"
                    ),
                ])
            ).toEqual(['entities/bars/server/loadBarsData.ts']);
        });

        it('주석의 언급은 위반이 아니다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'entities/bars/lib/a.ts',
                        '// aftermarket-trade 값은 여기 섞지 않는다\nexport const a = 1;'
                    ),
                ])
            ).toEqual([]);
        });

        it('허용된 파일은 통과한다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'shared/api/fmp/FmpMarketProvider.ts',
                        "fmpGet('aftermarket-trade', { symbol })"
                    ),
                    probe(
                        'entities/extended-hours/api.ts',
                        'await getFmpProvider().getExtendedHoursTrade(s)'
                    ),
                ])
            ).toEqual([]);
        });
    });
});
