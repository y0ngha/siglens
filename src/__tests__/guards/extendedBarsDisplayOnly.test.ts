import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **프리·애프터마켓 봉은 표시 전용이다** 가드.
 *
 * 확장 세션 봉(FMP `extended=true`)은 정규장 봉(`bars:*`)과 다른 계통이다. 정규장 봉은 지표·AI 분석·
 * 섹터 스캔·SEO 스냅샷의 입력이라 시간외 봉이 섞이면 지표가 어긋나고(프리마켓 거래량 적은 봉이 이동평균·
 * RSI에 들어감), 분석 결과·색인되는 HTML이 바뀐다. 그래서 확장 봉을 아는 파일을 **허용 목록으로**
 * 고정한다 — 목록 밖 파일이 이 메서드·캐시 키·모듈을 건드리면 실패한다. 새 소비자가 정말 필요하면
 * 이 목록을 고치는 리뷰가 곧 "표시 전용인가"를 묻는 자리다.
 *
 * 또 하나: 정규장 경로(`getBars`·`getCachedIntradayBars`·`getCachedDailyBars`와 FMP `getBars`)의
 * 본문이 확장 봉 이름을 언급하지 않는다. 기존 `bars:intrahist`·`bars:raw`·`bars:eodhist:v3` 키와
 * 요청 URL을 바꾸면 배포 직후 전 종목 캐시가 비어 FMP 429가 몰린다.
 *
 * 판정은 주석을 지운 소스에서 한다(TESTING.md#TE-42).
 */
const SRC_DIR = path.resolve(__dirname, '../..');

const TEST_FILE = /(^|\/)__tests__\/|\.test\.tsx?$/;

/** 확장 봉의 조회 쪽 이름(어댑터 메서드·포트 타입·provider 접근자). */
const PROVIDER_TOKENS: readonly RegExp[] = [
    /\bgetExtendedBars\b/,
    /\bExtendedBarsProvider\b/,
    /\bgetCachedExtendedBarsProvider\b/,
];

/** 확장 봉 전용 Redis 키 계통. */
const CACHE_KEY_TOKEN = /bars:(intrahist-ext|raw-ext)\b/;

/** 확장 봉 entity를 가리키는 import. */
const ENTITY_IMPORT =
    /from\s+['"](@\/entities\/extended-bars\/|\.\.?\/[^'"]*extended-bars\/)/;

/** 확장 봉 세션 규칙 모듈(`shared/lib/extendedBarsSession`)을 가리키는 import. */
const SESSION_IMPORT = /from\s+['"][^'"]*extendedBarsSession['"]/;

const ENTITY_DIR = 'entities/extended-bars/';

const PROVIDER_TOKEN_ALLOWED = [
    'shared/api/fmp/FmpMarketProvider.ts',
    'shared/api/market/marketProvider.types.ts',
    'shared/api/market/CachedMarketDataProvider.ts',
    'shared/api/market/getCachedMarketDataProvider.ts',
];
const CACHE_KEY_ALLOWED = ['shared/api/market/CachedMarketDataProvider.ts'];
/** 확장 봉 entity를 쓰는 곳: 종목 차트 뷰 한 곳(클라이언트 훅). */
const ENTITY_IMPORT_ALLOWED = ['views/symbol/ChartContent.tsx'];
/** 세션 규칙 모듈을 쓰는 곳: 확장 봉 entity·캐시 provider·차트 뷰·차트 위젯(표시). */
const SESSION_IMPORT_ALLOWED_FILES = [
    'shared/api/market/CachedMarketDataProvider.ts',
    'views/symbol/ChartContent.tsx',
];
const SESSION_IMPORT_ALLOWED_DIRS = [ENTITY_DIR, 'widgets/chart/'];

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
                !CACHE_KEY_ALLOWED.includes(rel) && CACHE_KEY_TOKEN.test(code)
        )
        .map(({ rel }) => rel);
}

function entityImportOffenders(files: SourceFile[]): string[] {
    return files
        .filter(
            ({ rel, code }) =>
                !rel.startsWith(ENTITY_DIR) &&
                !ENTITY_IMPORT_ALLOWED.includes(rel) &&
                ENTITY_IMPORT.test(code)
        )
        .map(({ rel }) => rel);
}

function sessionImportOffenders(files: SourceFile[]): string[] {
    return files
        .filter(
            ({ rel, code }) =>
                rel !== 'shared/api/market/extendedBarsSession.ts' &&
                !SESSION_IMPORT_ALLOWED_FILES.includes(rel) &&
                !startsWithAny(rel, SESSION_IMPORT_ALLOWED_DIRS) &&
                SESSION_IMPORT.test(code)
        )
        .map(({ rel }) => rel);
}

/**
 * `signature`로 시작하는 메서드/함수의 본문(중괄호 짝이 맞는 구간)을 돌려준다. 시그니처를 못 찾으면
 * `null` — 가드가 조용히 아무것도 검사하지 않는 일이 없도록 호출부가 `null`을 실패로 다룬다.
 */
function bodyOf(code: string, signature: RegExp): string | null {
    const match = signature.exec(code);
    if (match === null) return null;
    const open = code.indexOf('{', match.index + match[0].length - 1);
    if (open === -1) return null;
    let depth = 0;
    for (let i = open; i < code.length; i += 1) {
        if (code[i] === '{') depth += 1;
        if (code[i] === '}') {
            depth -= 1;
            if (depth === 0) return code.slice(open, i + 1);
        }
    }
    return null;
}

const EXTENDED_NAME = /extended|-ext\b|getExtendedBars/i;

function read(rel: string): string {
    return blankComments(readFileSync(path.join(SRC_DIR, rel), 'utf8'));
}

describe('프리·애프터마켓 봉은 표시 전용이다', () => {
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
        '확장 봉 조회 메서드·포트·접근자는 FMP 어댑터·캐시 provider·확장 봉 entity 밖에 없다(분석·섹터 스캔·SEO 포함)',
        () => {
            expect(providerTokenOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '`bars:intrahist-ext`·`bars:raw-ext` 캐시 키는 캐시 provider 한 곳에만 있다',
        () => {
            expect(cacheKeyOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '확장 봉 entity는 종목 차트 뷰만 import한다(분석·SEO·봉 entity·API 라우트는 못 쓴다)',
        () => {
            expect(entityImportOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '세션 규칙 모듈(`extendedBarsSession`)은 확장 봉 entity·캐시 provider·차트 뷰·차트 위젯만 쓴다',
        () => {
            expect(sessionImportOffenders(files)).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    describe('정규장 경로는 확장 봉을 모른다(기존 키·요청 URL 불변)', () => {
        it('FMP `getBars` 본문에 확장 봉 언급이 없고 extended=false로만 조회한다', () => {
            const body = bodyOf(
                read('shared/api/fmp/FmpMarketProvider.ts'),
                /async getBars\([^)]*\)[^{]*\{/
            );
            expect(body).not.toBeNull();
            expect(body).not.toMatch(EXTENDED_NAME);
            // 정규장 요청은 확장 인자에 `false`를 명시해 넘긴다(기본값에 기대지 않는다).
            expect(body).toMatch(/getIntradayBars\([\s\S]*false\s*\)/);
        });

        it.each([
            ['getBars', /getBars = \([^)]*\)[^{]*=>\s*\{/],
            [
                'getCachedIntradayBars',
                /private async getCachedIntradayBars\([^)]*\)[^{]*\{/,
            ],
            [
                'getCachedDailyBars',
                /private async getCachedDailyBars\([^)]*\)[^{]*\{/,
            ],
        ])(
            '캐시 provider `%s` 본문에 확장 봉 언급이 없다',
            (_name, signature) => {
                const body = bodyOf(
                    read('shared/api/market/CachedMarketDataProvider.ts'),
                    signature
                );
                expect(body).not.toBeNull();
                expect(body).not.toMatch(EXTENDED_NAME);
            }
        );
    });

    describe('검출기 자체', () => {
        const probe = (rel: string, code: string): SourceFile => ({
            rel,
            code: blankComments(code),
        });

        it('분석·섹터 스캔·SEO가 확장 봉 조회를 부르면 잡는다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'entities/analysis/lib/x.ts',
                        'const b = await provider.getExtendedBars(o);'
                    ),
                    probe(
                        'entities/seo-snapshot/y.ts',
                        "import type { ExtendedBarsProvider } from '@/shared/api/market/marketProvider.types';"
                    ),
                    probe(
                        'app/api/analysis/stream/route.ts',
                        'const p = getCachedExtendedBarsProvider();'
                    ),
                ])
            ).toEqual([
                'entities/analysis/lib/x.ts',
                'entities/seo-snapshot/y.ts',
                'app/api/analysis/stream/route.ts',
            ]);
        });

        it('다른 곳이 확장 봉 캐시 키를 읽거나 쓰면 잡는다', () => {
            expect(
                cacheKeyOffenders([
                    probe(
                        'entities/bars/lib/z.ts',
                        'const key = `bars:intrahist-ext:${s}`;'
                    ),
                    probe(
                        'shared/cache/w.ts',
                        "const k = 'bars:raw-ext:AAPL';"
                    ),
                ])
            ).toEqual(['entities/bars/lib/z.ts', 'shared/cache/w.ts']);
        });

        it('분석·봉 entity가 확장 봉 entity를 import하면 잡는다', () => {
            expect(
                entityImportOffenders([
                    probe(
                        'entities/bars/lib/loadBarsData.ts',
                        "import { x } from '@/entities/extended-bars/lib/extendedBarsRequest';"
                    ),
                    probe(
                        'entities/analysis/a.ts',
                        "import { h } from '@/entities/extended-bars/hooks/useExtendedBars';"
                    ),
                ])
            ).toEqual([
                'entities/bars/lib/loadBarsData.ts',
                'entities/analysis/a.ts',
            ]);
        });

        it('분석·SEO가 세션 규칙 모듈을 import하면 잡는다', () => {
            expect(
                sessionImportOffenders([
                    probe(
                        'entities/analysis/lib/runAnalysis.ts',
                        "import { mergeExtendedBars } from '@/shared/api/market/extendedBarsSession';"
                    ),
                ])
            ).toEqual(['entities/analysis/lib/runAnalysis.ts']);
        });

        it('`bodyOf`는 본문이 없으면 null이라 가드가 조용히 통과하지 않는다', () => {
            expect(bodyOf('const a = 1;', /async getBars\(\)\s*\{/)).toBeNull();
        });

        it('주석의 언급은 위반이 아니다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'entities/bars/lib/a.ts',
                        '// getExtendedBars 결과는 여기 섞지 않는다\nexport const a = 1;'
                    ),
                ])
            ).toEqual([]);
        });

        it('허용된 파일은 통과한다', () => {
            expect(
                providerTokenOffenders([
                    probe(
                        'shared/api/fmp/FmpMarketProvider.ts',
                        'async getExtendedBars() {}'
                    ),
                    probe(
                        'entities/extended-bars/api.ts',
                        'provider.getExtendedBars(o)'
                    ),
                ])
            ).toEqual([]);
            expect(
                entityImportOffenders([
                    probe(
                        'views/symbol/ChartContent.tsx',
                        "import { u } from '@/entities/extended-bars/hooks/useExtendedBars';"
                    ),
                ])
            ).toEqual([]);
        });
    });
});
