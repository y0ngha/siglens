import type { FunctionPin } from './functionPins';

/**
 * `NEVER_REJECTS`(`alarmReachability.ts`)의 함수와 그것이 기대는 순수 헬퍼의 AST 핀 표.
 * 각 핀은 정의가 reject하지 않는 모양 그대로인지 `functionPins.ts`의 `checkFunctionPin`이 확인한다.
 */
export interface PinEntry {
    readonly name: string;
    readonly file: string;
    readonly pin: FunctionPin;
}

const BRIEFING_FILE = 'src/entities/market-summary/api/briefingStaticCache.ts';
const MACRO_FILE = 'src/entities/economy/api/macroBriefingStaticCache.ts';
const NEWS_FILE = 'src/entities/market-news/api/marketNewsDigestStaticCache.ts';
const CACHE_NON_EMPTY_FILE = 'src/shared/cache/cacheNonEmpty.ts';
const REDIS_FILE = 'src/shared/cache/redisClient.ts';
const OFFLINE_FILE = 'src/shared/api/offlineBuild.ts';
const REDACT_FILE = 'src/shared/db/redactDbErrorForLog.ts';

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
export const LISTED_PINS: readonly PinEntry[] = [
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

export const ALL_PINS: readonly PinEntry[] = [...LISTED_PINS, ...SUPPORT_PINS];
