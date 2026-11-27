import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFilterPatterns } from './support/alarmFilterParse';
import {
    NEVER_REJECTS,
    findDeadLogSites,
    findLogSites,
    findOpaqueDeadLogs,
    logCanProduce,
    parseSource,
    type AstNode,
} from './support/alarmReachability';
import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import {
    catchInfo,
    checkFunctionPin,
    functionRanges,
    type FunctionPin,
} from './support/functionPins';

/**
 * **알람 필터 문구 도달 가능성 가드** (`docs/conventions/TOOLCHAIN.md#TC-38`).
 *
 * `alarmFilterPhrases`는 문구가 소스에 **있다**는 것만 본다. 그 로그가 실제로 찍힐 수 있는지는
 * 보지 않아서, 절대 reject하지 않는 호출(`peekBriefingStatic` → `cacheNonNull`이 모든 오류를 삼켜
 * `null`로 resolve)의 `.catch`·`catch {}` 안에 있는 로그를 알람 문구로 걸어도 통과했다
 * (2026-11-20 감사). 이 가드는 알람 필터의 모든 용어가 찍히는 `console.*` 호출을 찾아,
 * 그것이 대상이 절대 실패하지 않는 실패 경로 안에 있으면 실패한다.
 *
 * 검사하는 것은 목록(`NEVER_REJECTS`)의 함수에 **바로** 붙은 `.catch`/`.then(_, onRejected)` 안의
 * 로그뿐이다. `try`/`catch` 블록, 간접 호출, 메서드 호출, 헬퍼가 찍는 로그는 검사하지 않는다(TE-63,
 * 전체 목록과 해석 규칙은 `support/alarmReachability.ts` 머리 주석). 스캔 대상은 `src`의 비테스트
 * 소스뿐이다. `scripts`·`cache-handler`·core가 찍는 문구는 `UNLOCATED_TERMS`에 이유와 함께 둔다(양방향으로
 * 맞춰서, 새 용어가 위치를 못 찾으면 실패하고 낡은 항목도 실패한다).
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');
const INFRA_DIR = path.join(REPO_ROOT, 'infra/aws');

/** 위치를 못 찾는 용어와 이유. 알람 용어는 위치를 찾았거나 여기에 있어야 한다(TE-64). */
const UNLOCATED_TERMS: Readonly<Record<string, string>> = {
    'JavaScript heap out of memory':
        'V8/Node 런타임이 stderr로 찍는다(`alarmFilterPhrases`의 EXTERNAL_PHRASES와 같다)',
    '[isr-cache] s3 get failed': 'cache-handler/s3Store.mjs(스캔 대상 밖)',
    '[isr-cache] s3 set failed': 'cache-handler/s3Store.mjs(스캔 대상 밖)',
    '[isr-cache] tag sync failed': 'cache-handler/tagStore.mjs(스캔 대상 밖)',
    '[isr-cache] tag publish failed':
        'cache-handler/tagStore.mjs(스캔 대상 밖)',
    '[isr-cache] tag prune failed': 'cache-handler/tagStore.mjs(스캔 대상 밖)',
    '[agent] web search budget exhausted':
        '설치된 core `dist`가 찍는다(siglens-core 소스)',
    '[sec-ftd] trailer mismatch':
        '`deps.log(...)`로 주입된 로거가 찍는다(`console.*` 호출이 아니다)',
    '[cloudflared-down]':
        '온박스 서비스(systemd)가 CloudWatch로 보내는 로그다(코드 밖)',
    '[selfcheck]': '온박스 `siglens-selfcheck` 서비스가 보내는 로그다(코드 밖)',
    '[agent] busy':
        '다른 파일의 상수(`AGENT_BUSY_LOG`)를 인자로 넘긴다. 문구를 모르는 로그가 죽은 경로 안에 있는 곳은 `findOpaqueDeadLogs`가 확인한다',
    '[sec-13f] sec_blocked': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-13f] backlog': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-13f] universe_incomplete': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-ftd] sec_blocked': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-filings] sec_blocked': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-filings] backlog': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[sec-filings] cik_map_empty': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[dart-filings] auth_failed': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[dart-corp-code] rejected': '`deps.log(...)`로 주입된 로거가 찍는다',
    '[FearGreedRoute] getMarketFearGreedStatic failed':
        '문구를 `failureLog` 매개변수로 넘긴다(page.tsx의 설정 객체). 그 `console.*`는 죽은 경로 밖이다(`findOpaqueDeadLogs`가 확인)',
    '[FearGreedKrRoute] getMarketFearGreedKrStatic failed':
        '위와 같다(`failureLog` 매개변수)',
    '[FearGreedCryptoRoute] getMarketFearGreedCryptoStatic failed':
        '위와 같다(`failureLog` 매개변수)',
    'NAVER_CLIENT_ID/SECRET':
        '템플릿이 `${logTag}` 매개변수 슬롯으로 시작한다(naverSearch.ts)',
    'non-OK response':
        '템플릿이 `${logTag}` 매개변수 슬롯으로 시작한다(naverSearch.ts)',
};

/** 반증용 변형이 로그 앞에 붙이는 죽은 `.catch` 래퍼. */
const WRAP_PREFIX = 'cacheNonNull(f, k, o).catch(() => ';
/** 변형 파일 맨 앞에 붙여 `cacheNonNull`이 목록의 함수로 해석되게 하는 import. */
const IMPORT_CNN =
    "import { cacheNonNull } from '@/shared/cache/cacheNonNull';\n";

function isTestFile(file: string): boolean {
    return /[\\/]__tests__[\\/]|\.test\.tsx?$|\.spec\.ts$/.test(file);
}

const alarmTerms = (): string[] => {
    const scripts = readdirSync(INFRA_DIR)
        .filter(name => name.endsWith('.sh'))
        .map(name => ({
            file: name,
            text: readFileSync(path.join(INFRA_DIR, name), 'utf8'),
        }));
    return [...new Set(parseFilterPatterns(scripts).flatMap(p => p.terms))];
};

interface ParsedFile {
    readonly file: string;
    readonly text: string;
    readonly program: AstNode;
}

function parseRepo(): ParsedFile[] {
    return sourceFiles(path.join(REPO_ROOT, 'src'), ['.ts', '.tsx'])
        .filter(f => !isTestFile(f))
        .map(file => {
            const text = readFileSync(file, 'utf8');
            return {
                file: path.relative(REPO_ROOT, file),
                text,
                program: parseSource(text),
            };
        });
}

const BRIEFING_FILE = 'src/entities/market-summary/api/briefingStaticCache.ts';
const MACRO_FILE = 'src/entities/economy/api/macroBriefingStaticCache.ts';
const NEWS_FILE = 'src/entities/market-news/api/marketNewsDigestStaticCache.ts';
const CACHE_NON_EMPTY_FILE = 'src/shared/cache/cacheNonEmpty.ts';
const REDIS_FILE = 'src/shared/cache/redisClient.ts';
const OFFLINE_FILE = 'src/shared/api/offlineBuild.ts';
const REDACT_FILE = 'src/shared/db/redactDbErrorForLog.ts';

interface PinEntry {
    readonly name: string;
    readonly file: string;
    readonly pin: FunctionPin;
}

/** try/catch 래퍼 둘의 호출 이름(콜백·catch 안 호출 포함). */
const CACHE_TRY_CALLS = [
    'await',
    'console.error',
    'fetcher',
    'new NullResultError',
    'redactDbErrorForLog',
    'unstable_cache',
    'markSsrMiss',
    '(expr)',
];

/** `NEVER_REJECTS`의 함수. 이 표의 이름이 목록과 정확히 같아야 한다. */
const LISTED_PINS: readonly PinEntry[] = [
    {
        name: 'cacheNonNull',
        file: 'src/shared/cache/cacheNonNull.ts',
        pin: {
            async: true,
            exported: true,
            shape: {
                kind: 'try',
                catchCalls: [
                    'await',
                    'console.error',
                    'markSsrMiss',
                    'redactDbErrorForLog',
                ],
                catchMembers: ['console.error', 'tags[0]'],
            },
            calls: CACHE_TRY_CALLS,
            members: ['console.error', 'tags[0]'],
            paramPattern: true,
        },
    },
    {
        name: 'cacheNonEmptyOrNull',
        file: CACHE_NON_EMPTY_FILE,
        pin: {
            async: true,
            exported: true,
            shape: {
                kind: 'try',
                catchCalls: ['console.error', 'redactDbErrorForLog'],
                catchMembers: ['console.error'],
            },
            calls: [
                'await',
                'console.error',
                'fetcher',
                'new EmptyResultError',
                'redactDbErrorForLog',
                'staticSymbolCache',
            ],
            members: ['console.error', 'rows.length'],
        },
    },
    {
        name: 'cacheNonEmpty',
        file: CACHE_NON_EMPTY_FILE,
        pin: {
            async: true,
            exported: true,
            shape: { kind: 'nullish-default', callee: 'cacheNonEmptyOrNull' },
            calls: ['await', 'cacheNonEmptyOrNull'],
            members: [],
        },
    },
    {
        name: 'peekBriefingStatic',
        file: BRIEFING_FILE,
        pin: {
            async: false,
            exported: true,
            shape: {
                kind: 'return',
                callee: 'cacheNonNull',
                prefixStatements: 1,
                eagerCalls: [
                    'cacheNonNull',
                    'marketBriefingCacheTag',
                    'marketBriefingContextOf',
                ],
            },
            calls: [
                'await',
                'cacheNonNull',
                'marketBriefingCacheTag',
                'marketBriefingContextOf',
                'marketBriefingSeedSurface',
                'peekBriefingCache',
                'readHubSsrSeed',
            ],
            members: ['scope.id'],
        },
    },
    {
        name: 'peekMacroBriefingStatic',
        file: MACRO_FILE,
        pin: {
            async: false,
            exported: true,
            shape: {
                kind: 'return',
                callee: 'cacheNonNull',
                eagerCalls: ['cacheNonNull'],
            },
            calls: [
                'await',
                'cacheNonNull',
                'peekMacroBriefingCacheEntry',
                'readMacroBriefingSeed',
            ],
            members: [],
        },
    },
    {
        name: 'peekMarketNewsDigestStatic',
        file: NEWS_FILE,
        pin: {
            async: true,
            exported: true,
            shape: {
                kind: 'return',
                callee: 'cacheNonNull',
                eagerCalls: ['cacheNonNull', 'marketNewsDigestCacheTag'],
            },
            calls: [
                'cacheNonNull',
                'computeDigestPeek',
                'marketNewsDigestCacheTag',
            ],
            members: [],
        },
    },
];

/** 목록의 함수가 기대는 순수 헬퍼. `peek*`의 인자 평가와 `cacheNonNull`의 catch 안 호출이 던지지 않는다는 근거다. */
const SUPPORT_PINS: readonly PinEntry[] = [
    {
        name: 'marketBriefingCacheTag',
        file: BRIEFING_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 1 },
            calls: [],
            members: ['scope.id'],
        },
    },
    {
        name: 'marketNewsDigestCacheTag',
        file: NEWS_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 1 },
            calls: [],
            members: [],
        },
    },
    {
        name: 'marketBriefingContextOf',
        file: 'src/entities/market-summary/lib/marketBriefingContext.ts',
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 3 },
            calls: ['summary.indices.find'],
            members: [
                'index.symbol',
                'quote.price',
                'scope.marketLabel',
                'scope.volatilityIndexSymbol',
                'summary.indices',
                'summary.indices.find',
            ],
        },
    },
    {
        name: 'markSsrMiss',
        file: 'src/shared/cache/ssrMissMarker.ts',
        pin: {
            async: true,
            exported: true,
            shape: {
                kind: 'try',
                guard: 'getUpstashWriterCredentials',
                catchCalls: ['console.error', 'redactDbErrorForLog'],
                catchMembers: ['console.error'],
            },
            calls: [
                'await',
                'console.error',
                'getUpstashWriterCredentials',
                'keyOf',
                'redactDbErrorForLog',
                'runUpstashCommandOutsideFetch',
            ],
            members: ['console.error'],
        },
    },
    {
        name: 'getUpstashWriterCredentials',
        file: REDIS_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 2 },
            calls: ['getUpstashEnv'],
            members: ['env.token', 'env.url'],
        },
    },
    {
        name: 'getUpstashEnv',
        file: REDIS_FILE,
        pin: {
            async: false,
            exported: false,
            shape: { kind: 'plain', statements: 2 },
            calls: ['readUpstashEnv'],
            members: [],
        },
    },
    {
        name: 'readUpstashEnv',
        file: REDIS_FILE,
        pin: {
            async: false,
            exported: false,
            shape: { kind: 'plain', statements: 7 },
            calls: ['isOfflineBuild', 'warnOfflineBuildOnce'],
            members: [
                'OFFLINE_BUILD_SERVICE.UPSTASH',
                'process.env',
                'process.env.UPSTASH_REDIS_REST_READONLY_TOKEN',
                'process.env.UPSTASH_REDIS_REST_TOKEN',
                'process.env.UPSTASH_REDIS_REST_URL',
            ],
        },
    },
    {
        name: 'isOfflineBuild',
        file: OFFLINE_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 1 },
            calls: [],
            members: ['process.env', 'process.env.SIGLENS_OFFLINE_BUILD'],
        },
    },
    {
        name: 'warnOfflineBuildOnce',
        file: OFFLINE_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 3 },
            calls: ['console.warn', 'warnedServices.add', 'warnedServices.has'],
            members: [
                'console.warn',
                'warnedServices.add',
                'warnedServices.has',
            ],
        },
    },
    {
        name: 'redactDbErrorForLog',
        file: REDACT_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'plain', statements: 1 },
            calls: ['describeSafely', 'isDatabaseError'],
            members: [],
        },
    },
    {
        name: 'isDatabaseError',
        file: REDACT_FILE,
        pin: {
            async: false,
            exported: true,
            shape: { kind: 'try', catchCalls: [], catchMembers: [] },
            calls: ['walk'],
            members: [],
        },
    },
    {
        name: 'describeSafely',
        file: REDACT_FILE,
        pin: {
            async: false,
            exported: false,
            shape: { kind: 'try', catchCalls: [], catchMembers: [] },
            calls: ['describeDbErrorForLog'],
            members: [],
        },
    },
];

const ALL_PINS: readonly PinEntry[] = [...LISTED_PINS, ...SUPPORT_PINS];

const readRepoFile = (file: string): string =>
    readFileSync(path.join(REPO_ROOT, file), 'utf8');

/** 정의 하나를 잘라 낸 텍스트(`export`는 핀이 말하는 대로 붙인다). 변형 테스트의 원본이다. */
function functionSlice({ name, file, pin }: PinEntry): string {
    const text = readRepoFile(file);
    const { start, end } = functionRanges(text, name);
    return `${pin.exported ? 'export ' : ''}${text.slice(start, end)}`;
}

/** 첫 호출의 인자 목록 맨 앞에 `arg`를 끼운다. 호출이 없으면 본문 맨 앞에 문장으로 넣는다. */
function injectIntoFirstCall(inner: string, arg: string): string {
    // 주석 안의 `foo(`에 끼우지 않도록 주석을 같은 길이의 공백으로 가린 사본에서 위치를 찾는다.
    const blanked = inner.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, m =>
        ' '.repeat(m.length)
    );
    const call =
        /\b(?!if\b|catch\b|return\b|function\b)[A-Za-z_$][\w$.]*\(/.exec(
            blanked
        );
    if (call === null) return `${arg};${inner}`;
    const at = call.index + call[0].length;
    return `${inner.slice(0, at)}${arg}, ${inner.slice(at)}`;
}

/**
 * 핀 변형. 함수 소스 텍스트를 바꿔 다시 파싱한다. **모든 핀**에서 원본과 달라지고 거부돼야 한다.
 * 모양에 맞게 적용할 수 있으면(`return` 하나짜리) 그 자리를 직접 바꾸고, 아니면 같은 효과의 문장을 앞에 넣는다.
 */
const PIN_MUTATIONS: readonly {
    readonly label: string;
    readonly apply: (slice: string, entry: PinEntry) => string;
    /** 이 변형이 의미 있는 핀만(기본은 모든 핀). */
    readonly appliesTo?: (entry: PinEntry) => boolean;
}[] = (() => {
    /** `try` 모양 핀: catch 본문 안쪽을 바꾼다. `C`는 try 블록이 처음 부르는 함수다. */
    const inCatch = (
        slice: string,
        entry: PinEntry,
        edit: (inner: string, tryCallee: string, awaitPrefix: string) => string
    ): string => {
        const info = catchInfo(slice, entry.name);
        if (info === undefined)
            throw new Error(`${entry.name}: try 모양이 아니다`);
        const awaitPrefix = entry.pin.async ? 'await ' : '';
        return `${slice.slice(0, info.bodyStart)}${edit(slice.slice(info.bodyStart, info.bodyEnd), info.tryCallee, awaitPrefix)}${slice.slice(info.bodyEnd)}`;
    };
    const isTry = (entry: PinEntry): boolean => entry.pin.shape.kind === 'try';
    const inBody = (
        slice: string,
        entry: PinEntry,
        edit: (inner: string) => string
    ): string => {
        const { bodyStart, bodyEnd } = functionRanges(slice, entry.name);
        return `${slice.slice(0, bodyStart)}${edit(slice.slice(bodyStart, bodyEnd))}${slice.slice(bodyEnd)}`;
    };
    const returnShaped = (entry: PinEntry): boolean =>
        entry.pin.shape.kind === 'return' ||
        entry.pin.shape.kind === 'nullish-default';
    return [
        {
            label: '새 반환 경로(`if (c) return null;`)',
            apply: (s, e) =>
                inBody(s, e, inner => `if (c) return null; ${inner}`),
        },
        {
            label: '앞선 `throw`',
            apply: (s, e) => inBody(s, e, inner => `throw e0; ${inner}`),
        },
        {
            label: '`async` 추가/제거',
            apply: s =>
                /^(export )?async function/.test(s)
                    ? s.replace('async function', 'function')
                    : s.replace('function', 'async function'),
        },
        {
            label: '앞선 호출(`risky();`)',
            apply: (s, e) => inBody(s, e, inner => `risky(); ${inner}`),
        },
        {
            label: '반환 호출 뒤 `.then(v => v ?? risky())` 접미',
            apply: (s, e) =>
                inBody(s, e, inner =>
                    returnShaped(e)
                        ? inner.replace(
                              /\)\s*;?\s*$/,
                              ').then(v => v ?? risky());'
                          )
                        : `return x().then(v => v ?? risky()); ${inner}`
                ),
        },
        {
            label: '쉼표식 `return x(), risky();`',
            apply: (s, e) =>
                inBody(s, e, inner =>
                    returnShaped(e)
                        ? inner.replace(/\breturn\b/, 'return x(),')
                        : `return x(), risky(); ${inner}`
                ),
        },
        {
            label: '인자 목록의 새 호출(`risky()`, async면 `await risky()`)',
            apply: (s, e) =>
                inBody(s, e, inner =>
                    injectIntoFirstCall(
                        inner,
                        e.pin.async ? 'await risky()' : 'risky()'
                    )
                ),
        },
        {
            label: '호출을 담은 기본값 매개변수',
            apply: (s, e) =>
                s.replace(
                    new RegExp(`${e.name}(<[^>]*>)?\\(`),
                    m => `${m}zz = risky(), `
                ),
        },
        {
            label: '옵셔널 호출 `risky?.()`',
            apply: (s, e) =>
                inBody(s, e, inner => injectIntoFirstCall(inner, 'risky?.()')),
        },
        {
            label: 'catch에서 try의 호출을 다시 부른다(`await C();`)',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(s, e, (inner, c, aw) => `${aw}${c}(); ${inner}`),
        },
        {
            label: 'catch의 기존 호출 인자를 try의 호출로 감싼다',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(s, e, (inner, c, aw) =>
                    injectIntoFirstCall(inner, `${aw}${c}()`)
                ),
        },
        {
            label: 'catch에 `if (...) { await C(); }` 분기를 더한다',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(
                    s,
                    e,
                    (inner, c, aw) => `if (err) { ${aw}${c}(); } ${inner}`
                ),
        },
        {
            label: 'catch 매개변수를 구조 분해한다(`catch ({ stack })`)',
            appliesTo: isTry,
            apply: s =>
                s.replace(/catch\s*(\([^)]*\))?\s*\{/, 'catch ({ stack }) {'),
        },
        // 호출 이름이 늘지 않는데 던질 수 있는 구문: 속성 읽기·구조 분해·`await` 비호출·`as any`.
        {
            label: '인자 속 `(x as any)[3].y` 읽기',
            apply: (s, e) =>
                inBody(s, e, inner =>
                    injectIntoFirstCall(inner, '(e0 as any)[3].y')
                ),
        },
        {
            label: '`process.env.X.length` 읽기',
            apply: (s, e) =>
                inBody(s, e, inner => `void process.env.X.length; ${inner}`),
        },
        {
            label: '`await <매개변수>;`(호출이 아닌 await)',
            appliesTo: e => e.pin.async,
            apply: (s, e) => inBody(s, e, inner => `await e0; ${inner}`),
        },
        {
            label: 'catch 안 `.cause.x` 읽기',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(s, e, inner => `void e0.cause.x; ${inner}`),
        },
        {
            label: 'catch 본문의 구조 분해(`const { cause: { a } } = e0;`)',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(s, e, inner => `const { cause: { a } } = e0; ${inner}`),
        },
        {
            label: 'catch 호출 인자의 `(tags as any)[3].x`',
            appliesTo: isTry,
            apply: (s, e) =>
                inCatch(s, e, inner =>
                    injectIntoFirstCall(inner, '(tags as any)[3].x')
                ),
        },
        {
            label: 'catch 안 `await <매개변수>;`',
            appliesTo: e => isTry(e) && e.pin.async,
            apply: (s, e) => inCatch(s, e, inner => `await e0; ${inner}`),
        },
    ];
})();

/** 변형 개수(종류별). 표를 늘리고 이 숫자를 안 고치면 테스트가 알린다. */
const MUTATIONS_ALL = 11;
const MUTATIONS_ASYNC = 1;
const MUTATIONS_TRY = 7;
const MUTATIONS_ASYNC_TRY = 1;

describe('알람 필터 문구가 가리키는 로그는 실제로 닿을 수 있다', () => {
    const terms = alarmTerms();
    const files = parseRepo();
    const safe = NEVER_REJECTS;

    describe('NEVER_REJECTS 핀: 정의가 reject하지 않는 모양 그대로다(AST)', () => {
        it('핀 표의 목록 함수가 `NEVER_REJECTS`와 정확히 같다', () => {
            expect(LISTED_PINS.map(p => p.name).sort()).toEqual(
                [...NEVER_REJECTS].sort()
            );
        });

        it.each(ALL_PINS)('$name의 모양', ({ name, file, pin }) => {
            expect(checkFunctionPin(readRepoFile(file), name, pin)).toEqual([]);
        });

        it.each(ALL_PINS.map(e => [e.name, e] as const))(
            '%s의 핀은 모든 변형을 거부한다',
            (_name, entry) => {
                const slice = functionSlice(entry);
                expect(checkFunctionPin(slice, entry.name, entry.pin)).toEqual(
                    []
                );
                const applicable = PIN_MUTATIONS.filter(
                    m => m.appliesTo?.(entry) ?? true
                );
                // 변형이 조용히 걸러지지 않는다: 핀의 종류마다 도는 개수가 정해져 있다.
                const isTryPin = entry.pin.shape.kind === 'try';
                expect(applicable).toHaveLength(
                    MUTATIONS_ALL +
                        (entry.pin.async ? MUTATIONS_ASYNC : 0) +
                        (isTryPin ? MUTATIONS_TRY : 0) +
                        (isTryPin && entry.pin.async ? MUTATIONS_ASYNC_TRY : 0)
                );
                applicable.forEach(({ label, apply }) => {
                    const mutated = apply(slice, entry);
                    expect(mutated, label).not.toBe(slice);
                    expect(
                        checkFunctionPin(mutated, entry.name, entry.pin),
                        label
                    ).not.toEqual([]);
                });
            }
        );

        it('`try` 모양 핀은 5개, 그중 `async`는 3개다(변형 개수 가정)', () => {
            const tries = ALL_PINS.filter(e => e.pin.shape.kind === 'try');
            expect(tries.map(e => e.name).sort()).toEqual([
                'cacheNonEmptyOrNull',
                'cacheNonNull',
                'describeSafely',
                'isDatabaseError',
                'markSsrMiss',
            ]);
            expect(tries.filter(e => e.pin.async)).toHaveLength(3);
        });

        it('각 목록 이름은 비테스트 `src`에 정확히 한 번만 정의된다', () => {
            const definitions = (name: string) =>
                files
                    .filter(f =>
                        new RegExp(
                            `\\bfunction ${name}\\b|\\b(?:const|let|var) ${name}\\b`
                        ).test(f.text)
                    )
                    .map(f => f.file);
            expect(
                Object.fromEntries(
                    LISTED_PINS.map(({ name }) => [name, definitions(name)])
                )
            ).toEqual(
                Object.fromEntries(
                    LISTED_PINS.map(({ name, file }) => [name, [file]])
                )
            );
        });
    });

    it(
        '알람 용어를 찍는 로그가 절대 reject하지 않는 함수에 바로 붙은 `.catch`·`.then` 안에 없다',
        () => {
            const dead = files.flatMap(f =>
                findDeadLogSites(f.file, f.text, f.program, terms, safe)
            );
            expect(
                dead.map(d => `${d.file}:${d.line} "${d.term}" — ${d.reason}`)
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '문구를 모르는 로그가 그런 `.catch` 안에 있지 않다(조용히 건너뛰지 않는다)',
        () => {
            expect(
                files.flatMap(f =>
                    findOpaqueDeadLogs(f.file, f.text, f.program, safe)
                )
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '위치를 못 찾는 용어는 이유가 적힌 목록과 정확히 같다(양방향)',
        () => {
            const located = new Set(
                files
                    .flatMap(f =>
                        findLogSites(f.file, f.text, f.program, terms, safe)
                    )
                    .map(s => s.term)
            );
            const unlocated = terms.filter(t => !located.has(t));
            expect(unlocated.filter(t => !(t in UNLOCATED_TERMS))).toEqual([]);
            expect(
                Object.keys(UNLOCATED_TERMS).filter(
                    t => !terms.includes(t) || located.has(t)
                )
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '실제 저장소 반증: 과거에 죽어 있던 `[MarketContent:kr]` 쌍을 필터에 걸면 그 로그를 잡는다',
        () => {
            const dead = files.flatMap(f =>
                findDeadLogSites(
                    f.file,
                    f.text,
                    f.program,
                    ['[MarketContent:kr] peekBriefingStatic failed'],
                    safe
                )
            );
            expect(dead.map(d => d.file)).toEqual([
                'src/app/[locale]/market/MarketRouteBody.tsx',
            ]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '실제 위치마다 로그를 `cacheNonNull(...).catch(() => <로그>)`로 옮기면 죽은 것으로 잡힌다(생존 0)',
        () => {
            const sites = files.flatMap(f =>
                findLogSites(f.file, f.text, f.program, terms, safe).map(
                    site => ({ site, text: f.text })
                )
            );
            const unique = new Map(
                sites.map(({ site, text }) => [
                    `${site.file}:${site.start}:${site.term}`,
                    { site, text },
                ])
            );
            const survivors = [...unique.values()]
                .filter(({ site, text }) => {
                    // import를 맨 앞에 붙여 `cacheNonNull`이 목록의 함수로 해석되게 한다(오프셋은 그만큼 민다).
                    const mutated = `${IMPORT_CNN}${text.slice(0, site.start)}${WRAP_PREFIX}${text.slice(site.start, site.end)})${text.slice(site.end)}`;
                    const start =
                        site.start + IMPORT_CNN.length + WRAP_PREFIX.length;
                    return !findDeadLogSites(
                        site.file,
                        mutated,
                        parseSource(mutated),
                        [site.term],
                        safe
                    ).some(d => d.start === start);
                })
                .map(({ site }) => `${site.file}:${site.line} "${site.term}"`);
            expect(unique.size).toBeGreaterThanOrEqual(50);
            expect(survivors).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );
});

describe('핀 검사 반증(호출 이름 집합이 같아도 모양이 틀리면 거부한다)', () => {
    const problems = (
        code: string,
        pin: Partial<FunctionPin> & Pick<FunctionPin, 'shape' | 'calls'>
    ) =>
        checkFunctionPin(code, 'w', {
            async: false,
            exported: false,
            members: [],
            ...pin,
        });
    /** `return cacheNonNull(...)` 모양. 즉시 평가 호출 집합은 기본으로 호출 이름 전체와 같다고 둔다. */
    const ret = (
        eager: readonly string[]
    ): Extract<FunctionPin['shape'], { kind: 'return' }> => ({
        kind: 'return',
        callee: 'cacheNonNull',
        eagerCalls: eager,
    });
    const TRY: FunctionPin['shape'] = {
        kind: 'try',
        catchCalls: [],
        catchMembers: [],
    };

    it('대조: 허용하는 모양은 통과한다', () => {
        expect(
            problems('function w(a) { return cacheNonNull(a); }', {
                shape: ret(['cacheNonNull']),
                calls: ['cacheNonNull'],
            })
        ).toEqual([]);
        expect(
            problems(
                'async function w(a) { try { return await f(a); } catch { return null; } }',
                { async: true, shape: TRY, calls: ['await', 'f'] }
            )
        ).toEqual([]);
    });

    it.each([
        [
            '`.then` 접미(새 이름이 `.then`뿐)',
            'function w(a) { return cacheNonNull(a).then(v => v); }',
            ['(expr).then', 'cacheNonNull'],
        ],
        [
            '쉼표식',
            'function w(a) { return a, cacheNonNull(a); }',
            ['cacheNonNull'],
        ],
        [
            '반환 값 앞의 단언 래핑이 아닌 다른 식',
            'function w(a) { return a ? cacheNonNull(a) : null; }',
            ['cacheNonNull'],
        ],
        [
            '`return`이 둘',
            'function w(a) { if (a) return 1; return cacheNonNull(a); }',
            ['cacheNonNull'],
        ],
        [
            'const가 아닌 선행 문장',
            'function w(a) { a = 1; return cacheNonNull(a); }',
            ['cacheNonNull'],
        ],
        [
            '`throw`',
            'function w(a) { throw a; return cacheNonNull(a); }',
            ['cacheNonNull'],
        ],
        ['다른 callee', 'function w(a) { return other(a); }', ['other']],
    ])('return 모양: %s', (_label, code, calls) => {
        expect(problems(code, { shape: ret(calls), calls })).not.toEqual([]);
    });

    it('return 모양: `new`·const가 아닌 선행 문장·옵셔널 호출은 이름이 같아도 거부한다', () => {
        expect(
            problems('function w(a) { return new cacheNonNull(a); }', {
                shape: ret(['new cacheNonNull']),
                calls: ['new cacheNonNull'],
            })
        ).not.toEqual([]);
        expect(
            problems('function w(a) { a = 1; return cacheNonNull(a); }', {
                shape: { ...ret(['cacheNonNull']), prefixStatements: 1 },
                calls: ['cacheNonNull'],
            })
        ).not.toEqual([]);
        expect(
            problems('function w(a) { const b = 1; return cacheNonNull(a); }', {
                shape: { ...ret(['cacheNonNull']), prefixStatements: 1 },
                calls: ['cacheNonNull'],
            })
        ).toEqual([]);
        // 허용 목록이 `f`여도 `f?.()`는 `?.f`로 세므로 다르다.
        expect(
            problems('function w(a) { return cacheNonNull(f?.(a)); }', {
                shape: ret(['cacheNonNull', 'f']),
                calls: ['cacheNonNull', 'f'],
            })
        ).not.toEqual([]);
    });

    it.each([
        [
            '기본값 매개변수의 호출',
            'function w(a = f()) { return cacheNonNull(a); }',
            ['cacheNonNull', 'f'],
        ],
        [
            '기본값 매개변수의 옵셔널 호출',
            'function w(a = f?.()) { return cacheNonNull(a); }',
            ['cacheNonNull', '?.f'],
        ],
        [
            '구조 분해 기본값의 `new`',
            'function w({ a = new X() }) { return cacheNonNull(a); }',
            ['cacheNonNull', 'new X'],
        ],
    ])('매개변수: %s', (_label, code, calls) => {
        expect(problems(code, { shape: ret(calls), calls })).not.toEqual([]);
    });

    it.each([
        [
            'async인데 await 없는 try return',
            'async function w() { try { return f(); } catch { return null; } }',
            ['f'],
        ],
        [
            'catch가 promise를 돌려준다',
            'async function w() { try { return await f(); } catch { return g(); } }',
            ['await', 'f', 'g'],
        ],
        [
            'catch의 throw',
            'async function w() { try { return await f(); } catch (e) { throw e; } }',
            ['await', 'f'],
        ],
        [
            'finally',
            'async function w() { try { return await f(); } catch { return null; } finally { x = 1; } }',
            ['await', 'f'],
        ],
        [
            'try 밖의 문장',
            'async function w() { x = 1; try { return await f(); } catch { return null; } }',
            ['await', 'f'],
        ],
        [
            'catch 없는 try',
            'async function w() { try { return await f(); } finally { x = 1; } }',
            ['await', 'f'],
        ],
    ])('try 모양: %s', (_label, code, calls) => {
        expect(
            problems(code, {
                async: true,
                shape: {
                    kind: 'try',
                    catchCalls: calls.includes('g') ? ['g'] : [],
                    catchMembers: [],
                },
                calls,
            })
        ).not.toEqual([]);
    });

    it('catch: try에서 쓴 호출을 다시 부르거나 매개변수를 구조 분해하면 함수 전체 호출 집합이 같아도 거부한다', () => {
        const pin = {
            async: true,
            shape: {
                kind: 'try',
                catchCalls: ['g'],
                catchMembers: [],
            } as const,
            calls: ['await', 'f', 'g'],
        };
        const code = (handler: string) =>
            `async function w() { try { return await f(); } ${handler} }`;
        expect(problems(code('catch (e) { g(e); return null; }'), pin)).toEqual(
            []
        );
        // 함수 전체의 호출 이름은 그대로(`await`·`f`·`g`)지만 catch가 `f`를 다시 부른다.
        expect(
            problems(code('catch (e) { g(e); await f(); return null; }'), pin)
        ).not.toEqual([]);
        expect(
            problems(code('catch (e) { g(await f()); return null; }'), pin)
        ).not.toEqual([]);
        expect(
            problems(code('catch ({ stack }) { g(stack); return null; }'), pin)
        ).not.toEqual([]);
        expect(
            problems(code('catch ([a]) { g(a); return null; }'), pin)
        ).not.toEqual([]);
        // catchCalls에 없는 호출 / 있는 호출이 빠진 경우도 정확히 비교한다.
        expect(problems(code('catch (e) { return null; }'), pin)).not.toEqual(
            []
        );
    });

    it('호출 이름이 같아도 새 속성 읽기·구조 분해·비호출 await·`as any`·`!`는 거부한다', () => {
        const base = {
            async: true,
            shape: TRY,
            calls: ['await', 'f'],
            members: [] as string[],
        };
        const w = (inner: string) =>
            `async function w(e0) { try { ${inner} } catch { return null; } }`;
        expect(problems(w('return await f();'), base)).toEqual([]);
        // 멤버 허용 목록에 없는 읽기.
        expect(problems(w('return await f(e0.x);'), base)).not.toEqual([]);
        expect(problems(w('return await f(e0[3]);'), base)).not.toEqual([]);
        expect(problems(w('return await f(e0?.x);'), base)).not.toEqual([]);
        // 허용 목록에 넣으면 통과한다(정규화 텍스트 `e0.x`·`e0[3]`·`e0?.x`).
        expect(
            problems(w('return await f(e0.x);'), { ...base, members: ['e0.x'] })
        ).toEqual([]);
        expect(
            problems(w('return await f(e0[3]);'), {
                ...base,
                members: ['e0[3]'],
            })
        ).toEqual([]);
        expect(
            problems(w('return await f(e0?.x);'), {
                ...base,
                members: ['e0?.x'],
            })
        ).toEqual([]);
        // 구조 분해는 허용 목록과 무관하게 거부한다.
        expect(
            problems(w('const { a } = e0; return await f();'), base)
        ).not.toEqual([]);
        expect(
            problems(w('const [a] = e0; return await f();'), base)
        ).not.toEqual([]);
        expect(
            problems(w('for (const a of e0) {} return await f();'), base)
        ).not.toEqual([]);
        expect(
            problems(w('for (const a in e0) {} return await f();'), base)
        ).not.toEqual([]);
        // 호출이 아닌 await, `as any`, `!`.
        expect(problems(w('await e0; return await f();'), base)).not.toEqual(
            []
        );
        expect(problems(w('return await f(e0 as any);'), base)).not.toEqual([]);
        expect(problems(w('return await f(e0!);'), base)).not.toEqual([]);
        // `as any` 뒤 멤버 읽기는 멤버로도 걸린다.
        expect(
            problems(w('return await f((e0 as any).x);'), {
                ...base,
                members: ['e0.x'],
            })
        ).not.toEqual([]);
    });

    it('매개변수 구조 분해는 `paramPattern`이 있고 평평한 객체 패턴일 때만 허용한다', () => {
        const pin = { shape: TRY, calls: ['f'], members: [] as string[] };
        const fn = (param: string) =>
            `function w(${param}) { try { return f(); } catch { return null; } }`;
        expect(problems(fn('{ a, b }'), pin)).not.toEqual([]);
        expect(
            problems(fn('{ a, b }'), { ...pin, paramPattern: true })
        ).toEqual([]);
        expect(
            problems(fn('{ a: { b } }'), { ...pin, paramPattern: true })
        ).not.toEqual([]);
        expect(
            problems(fn('{ a = 1 }'), { ...pin, paramPattern: true })
        ).not.toEqual([]);
        expect(problems(fn('[a]'), { ...pin, paramPattern: true })).not.toEqual(
            []
        );
        expect(
            problems(fn('{ ...rest }'), { ...pin, paramPattern: true })
        ).not.toEqual([]);
    });

    it('try에서 읽던 멤버를 catch에서도 읽으면(함수 전체 멤버 집합은 그대로) `catchMembers`가 거부한다', () => {
        const pin = {
            async: true,
            shape: {
                kind: 'try',
                catchCalls: ['g'],
                catchMembers: [],
            } as const,
            calls: ['await', 'f', 'g'],
            members: ['e0.x'],
        };
        const code = (inCatch: string) =>
            `async function w(e0) { try { return await f(e0.x); } catch (e) { g(${inCatch}); return null; } }`;
        expect(problems(code('e'), pin)).toEqual([]);
        expect(problems(code('e0.x'), pin)).not.toEqual([]);
    });

    it('`paramPattern`이 있어도 본문 안 구조 분해는 거부한다', () => {
        const pin = {
            shape: TRY,
            calls: ['f'],
            members: [] as string[],
            paramPattern: true,
        };
        expect(
            problems(
                'function w({ a }) { try { return f(a); } catch { return null; } }',
                pin
            )
        ).toEqual([]);
        expect(
            problems(
                'function w({ a }, o) { try { const { b } = o; return f(a); } catch { return null; } }',
                pin
            )
        ).not.toEqual([]);
    });

    it('catch 안 멤버 접근은 `catchMembers`와 정확히 같아야 한다', () => {
        const pin = {
            async: true,
            shape: {
                kind: 'try',
                catchCalls: ['g'],
                catchMembers: [],
            } as const,
            calls: ['await', 'f', 'g'],
            members: [] as string[],
        };
        const code = (h: string) =>
            `async function w() { try { return await f(); } catch (e) { ${h} } }`;
        expect(problems(code('g(e); return null;'), pin)).toEqual([]);
        expect(problems(code('g(e.cause.x); return null;'), pin)).not.toEqual(
            []
        );
        expect(
            problems(code('g(e.cause.x); return null;'), {
                ...pin,
                shape: { ...pin.shape, catchMembers: ['e.cause', 'e.cause.x'] },
                members: ['e.cause', 'e.cause.x'],
            })
        ).toEqual([]);
    });

    it('return 모양: 콜백 밖으로 옮겨진 호출(즉시 평가)은 호출 이름 집합이 같아도 거부한다', () => {
        const pin = {
            shape: { ...ret(['cacheNonNull']) },
            calls: ['cacheNonNull', 'load'],
        };
        expect(
            problems(
                'function w(a) { return cacheNonNull(() => load(a)); }',
                pin
            )
        ).toEqual([]);
        expect(
            problems('function w(a) { return cacheNonNull(load(a)); }', pin)
        ).not.toEqual([]);
    });

    it('가드: 틀린 호출·인자·else·반환 값이면 거부한다', () => {
        const pin = {
            async: true,
            shape: {
                kind: 'try',
                guard: 'g',
                catchCalls: [],
                catchMembers: [],
            } as const,
            calls: ['await', 'f', 'g'],
        };
        const body = 'try { await f(); } catch { return; }';
        expect(
            problems(
                `async function w() { if (g() === null) return; ${body} }`,
                pin
            )
        ).toEqual([]);
        expect(
            problems(
                `async function w() { if (g() !== null) return; ${body} }`,
                pin
            )
        ).not.toEqual([]);
        expect(
            problems(
                `async function w() { if (g(1) === null) return; ${body} }`,
                pin
            )
        ).not.toEqual([]);
        expect(
            problems(
                `async function w() { if (g() === undefined) return; ${body} }`,
                pin
            )
        ).not.toEqual([]);
        expect(
            problems(
                `async function w() { if (g() === null) return 1; ${body} }`,
                pin
            )
        ).not.toEqual([]);
        expect(
            problems(
                `async function w() { if (g() === null) return; else x(); ${body} }`,
                { ...pin, calls: [...pin.calls, 'x'] }
            )
        ).not.toEqual([]);
        expect(problems(`async function w() { ${body} }`, pin)).not.toEqual([]);
    });

    it('nullish-default: 기본값이 `[]`가 아니거나 await가 없으면 거부한다', () => {
        const pin = {
            async: true,
            shape: { kind: 'nullish-default', callee: 'f' } as const,
            calls: ['await', 'f'],
        };
        expect(
            problems('async function w() { return (await f()) ?? []; }', pin)
        ).toEqual([]);
        expect(
            problems('async function w() { return (await f()) ?? [1]; }', pin)
        ).not.toEqual([]);
        expect(
            problems('async function w() { return (await f()) || []; }', pin)
        ).not.toEqual([]);
        expect(
            problems('async function w() { return f() ?? []; }', {
                ...pin,
                calls: ['f'],
            })
        ).not.toEqual([]);
    });

    it('plain: 문장 수·throw·async·export 여부', () => {
        const pin = {
            shape: { kind: 'plain', statements: 1 } as const,
            calls: [],
        };
        expect(problems('function w() { return 1; }', pin)).toEqual([]);
        expect(
            problems('function w() { return 1; return 2; }', pin)
        ).not.toEqual([]);
        expect(problems('function w() { throw 1; }', pin)).not.toEqual([]);
        expect(problems('async function w() { return 1; }', pin)).not.toEqual(
            []
        );
        expect(problems('export function w() { return 1; }', pin)).not.toEqual(
            []
        );
        expect(problems('function v() { return 1; }', pin)).not.toEqual([]);
    });
});

describe('매처 반증', () => {
    const IMPORTS = `import { cacheNonNull } from '@/shared/cache/cacheNonNull';\nimport { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';\n`;
    const run = (code: string, terms: string[]) => {
        const text = IMPORTS + code;
        return findDeadLogSites(
            'x.ts',
            text,
            parseSource(text),
            terms,
            NEVER_REJECTS
        ).map(d => d.term);
    };
    const runBare = (text: string, terms: string[]) =>
        findDeadLogSites(
            'x.ts',
            text,
            parseSource(text),
            terms,
            NEVER_REJECTS
        ).map(d => d.term);

    it('목록의 함수에 바로 붙은 `.catch` 콜백의 로그를 잡는다', () => {
        const code = `async function page() {
            await peekBriefingStatic(a, b, c).catch(e => console.error('[X] peek failed:', e));
        }`;
        expect(run(code, ['[X] peek failed'])).toEqual(['[X] peek failed']);
    });

    it('템플릿 슬롯이 든 로그(`[X:${id}]`)도 용어 `[X:kr]`로 잡는다', () => {
        const code = `async function page(id: string) {
            await cacheNonNull(f, k, o).catch(e => console.error(\`[X:\${id}] load failed:\`, e));
        }`;
        expect(run(code, ['[X:kr] load failed'])).toEqual([
            '[X:kr] load failed',
        ]);
    });

    it('같은 파일의 `const TAG`와 템플릿 슬롯을 풀어 용어를 만든다', () => {
        const code = `const TAG = '[T]';
        async function page() {
            await cacheNonNull(f, k, o).catch(() => console.warn(\`\${TAG} budget gone\`));
        }`;
        expect(run(code, ['[T] budget gone'])).toEqual(['[T] budget gone']);
    });

    describe('`.then`', () => {
        it('두 번째 인자(onRejected)는 잡는다', () => {
            expect(
                run(
                    `async function a() { await cacheNonNull(f,k,o).then(ok, () => console.error('[R] second')); }`,
                    ['[R] second']
                )
            ).toEqual(['[R] second']);
        });
        it.each([
            [
                '첫 인자(onFulfilled)',
                `cacheNonNull(f,k,o).then(() => console.error('[R] x'));`,
            ],
            [
                '`.then(cb).catch(log)` 체인',
                `cacheNonNull(f,k,o).then(cb).catch(() => console.error('[R] x'));`,
            ],
            [
                '`.then(_, cb)`가 아닌 `.finally`',
                `cacheNonNull(f,k,o).finally(() => console.error('[R] x'));`,
            ],
        ])('놓아 준다: %s', (_label, body) => {
            expect(run(`async function a() { ${body} }`, ['[R] x'])).toEqual(
                []
            );
        });
    });

    describe('검사하지 않는다(한계)', () => {
        it.each([
            [
                '던질 수 있는 함수',
                `realFetch().catch(() => console.error('[N] x'));`,
            ],
            [
                '메서드 호출',
                `obj.peekBriefingStatic(a).catch(() => console.error('[N] x'));`,
            ],
            [
                '`Promise.allSettled` 수신(non-iterable·던지는 iterator면 reject한다)',
                `Promise.allSettled(x).catch(() => console.error('[N] x'));`,
            ],
            [
                '`await`한 값의 `.catch`(promise가 아니라 결과 값에 붙는다)',
                `(await cacheNonNull(f,k,o)).catch(() => console.error('[N] x'));`,
            ],
            [
                '`Promise.all` 수신',
                `Promise.all([cacheNonNull(f,k,o)]).catch(() => console.error('[N] x'));`,
            ],
            [
                '변수에 담은 promise',
                `const p = cacheNonNull(f,k,o); p.catch(() => console.error('[N] x'));`,
            ],
            [
                '`try`/`catch` 블록',
                `try { await cacheNonNull(f,k,o); } catch { console.error('[N] x'); }`,
            ],
            [
                'catch 밖의 같은 로그',
                `await cacheNonNull(f,k,o); console.error('[N] x');`,
            ],
        ])('%s', (_label, body) => {
            expect(run(`async function a() { ${body} }`, ['[N] x'])).toEqual(
                []
            );
        });
    });

    describe('이름 해석', () => {
        const body = `await cacheNonNull(f,k,o).catch(() => console.error('[V] x'));`;
        it('import 별칭을 풀어 `cnn(...)`도 `cacheNonNull`로 본다', () => {
            expect(
                runBare(
                    `import { cacheNonNull as cnn } from '@/shared/cache/cacheNonNull';\nasync function a() { await cnn(f,k,o).catch(() => console.error('[V] x')); }`,
                    ['[V] x']
                )
            ).toEqual(['[V] x']);
        });
        it('상대 경로 import도 해석한다', () => {
            expect(
                runBare(
                    `import { cacheNonNull } from './cacheNonNull';\nasync function a() { ${body} }`,
                    ['[V] x']
                )
            ).toEqual(['[V] x']);
        });
        it.each([
            [
                '패키지 import(이름이 같아도)',
                `import { cacheNonNull } from 'some-package';\nasync function a() { ${body} }`,
            ],
            [
                '다른 이름으로 가져온 별칭',
                `import { other as cacheNonNull } from '@/x';\nasync function a() { ${body} }`,
            ],
            [
                '기본 import',
                `import cacheNonNull from '@/x';\nasync function a() { ${body} }`,
            ],
            ['import하지 않은 이름', `async function a() { ${body} }`],
            [
                'import를 매개변수가 다시 선언',
                `import { cacheNonNull } from '@/x';\nasync function a(cacheNonNull) { ${body} }`,
            ],
        ])('해석하지 않는다: %s', (_label, code) => {
            expect(runBare(code, ['[V] x'])).toEqual([]);
        });
        describe('같은 파일의 const 함수', () => {
            const make = (decl: string, extra = '') =>
                `${decl}\n${extra}\nasync function a() { await peekBriefingStatic(1).catch(() => console.error('[V] x')); }`;
            it('대조: `const f = () => …`는 해석한다', () => {
                expect(
                    runBare(
                        make(
                            `const peekBriefingStatic = (n) => cacheNonNull(f,k,o);`
                        ),
                        ['[V] x']
                    )
                ).toEqual(['[V] x']);
            });
            it.each([
                ['let', `let peekBriefingStatic = (n) => 1;`, ''],
                [
                    'var',
                    `var peekBriefingStatic = function (n) { return 1; };`,
                    '',
                ],
                [
                    '함수 선언',
                    `function peekBriefingStatic(n) { return 1; }`,
                    '',
                ],
                [
                    '재할당',
                    `const peekBriefingStatic = (n) => 1;`,
                    `peekBriefingStatic = other;`,
                ],
                [
                    '재선언(중복 바인딩)',
                    `const peekBriefingStatic = (n) => 1;`,
                    `function g() { const peekBriefingStatic = x; }`,
                ],
                [
                    '함수가 아닌 const',
                    `const peekBriefingStatic = makeIt();`,
                    '',
                ],
            ])('해석하지 않는다: %s', (_label, decl, extra) => {
                expect(runBare(make(decl, extra), ['[V] x'])).toEqual([]);
            });
        });
    });

    describe('문구를 모르는 로그', () => {
        const opaque = (code: string) => {
            const text = IMPORTS + code;
            return findOpaqueDeadLogs(
                'x.ts',
                text,
                parseSource(text),
                NEVER_REJECTS
            );
        };
        it.each([
            [
                '첫 인자가 매개변수',
                `async function a(msg: string) { await cacheNonNull(f,k,o).catch(e => console.error(msg, e)); }`,
            ],
            [
                '템플릿이 슬롯으로 시작',
                `async function a(tag: string) { await cacheNonNull(f,k,o).catch(e => console.error(\`\${tag}: failed\`, e)); }`,
            ],
            [
                '문자열 연결이 슬롯으로 시작',
                `async function a(tag: string) { await peekBriefingStatic(1).catch(e => console.error(tag + ': failed', e)); }`,
            ],
        ])('죽은 `.catch` 안이면 목록으로 낸다: %s', (_label, code) => {
            expect(opaque(code)).toHaveLength(1);
        });
        it.each([
            [
                '죽은 경로 밖',
                `async function a(tag: string) { console.error(\`\${tag}: failed\`); }`,
            ],
            [
                '던질 수 있는 함수의 `.catch`',
                `async function a(tag: string) { await realFetch().catch(() => console.error(\`\${tag}: failed\`)); }`,
            ],
            [
                '문구가 있는 로그',
                `async function a() { await cacheNonNull(f,k,o).catch(() => console.error('[ok] known')); }`,
            ],
            [
                '같은 파일 const로 풀리는 로그',
                `const TAG = '[t]';\nasync function a() { await cacheNonNull(f,k,o).catch(() => console.error(\`\${TAG} x\`)); }`,
            ],
        ])('목록에 내지 않는다: %s', (_label, code) => {
            expect(opaque(code)).toEqual([]);
        });
    });

    it('문구 매칭: 슬롯은 `[\\w:-]+`, 용어는 로그 문구의 어느 글자에서 시작하거나 접두여도 된다', () => {
        expect(
            logCanProduce(['[M:', '] peek failed:'], '[M:kr] peek failed')
        ).toBe(true);
        expect(logCanProduce(['[M:', '] peek failed:'], '[M:kr] other')).toBe(
            false
        );
        expect(logCanProduce(['', '] x'], '[a] x')).toBe(false);
        expect(logCanProduce(['abc def'], 'c d')).toBe(true);
        expect(logCanProduce(['[G] set failed: ', ''], '[G] set failed')).toBe(
            true
        );
        expect(logCanProduce(['pre non-OK ', ' tail'], 'non-OK x t')).toBe(
            true
        );
        // 용어가 슬롯에서 끝나 마지막 고정 문구에 닿지 않으면 문구를 만든다고 보지 않는다.
        expect(logCanProduce(['pre non-OK ', ' tail'], 'non-OK x')).toBe(false);
        expect(logCanProduce(['[', '] run failed'], '[cloudflared-down]')).toBe(
            false
        );
        expect(logCanProduce(['[', '] run failed'], '[cron-x] run')).toBe(true);
    });
});
