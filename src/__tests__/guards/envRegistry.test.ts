import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ENV_REGISTRY,
    type EnvReader,
    type EnvSource,
    type EnvSpec,
} from '@/shared/config/envRegistry';
import { renderEnvGate } from '../../../scripts/generate-env-gate';
import { scanEnvReads, scanEnvSource } from './support/envReads';

/**
 * **env 레지스트리 가드.**
 *
 * `envRegistry.ts`가 환경 변수의 단일 목록이다. 코드는 `process.env.X`를 리터럴로 읽으므로
 * (Next 인라인·cache-handler·core 때문에 접근자로 바꾸지 않는다) 목록이 코드와 어긋나도 컴파일은
 * 통과한다. 어긋나면 조용히 생기는 사고는 정해져 있다 — 새 키가 배포 게이트에 없어 SSM 누락으로
 * 런타임에서야 깨지거나, 지운 키가 `.env.example`에 남아 아무도 모르는 죽은 설정이 되거나,
 * 빌드 타임에 필요한 값이 build-arg 없이 조용히 비어 나간다.
 */
const ROOT = path.resolve(__dirname, '../../..');
const registry: readonly EnvSpec[] = ENV_REGISTRY;
const byName = new Map(registry.map(spec => [spec.name, spec]));

const read = (relative: string): string =>
    readFileSync(path.join(ROOT, relative), 'utf8');

function filesUnder(dir: string, pattern: RegExp): readonly string[] {
    return readdirSync(path.join(ROOT, dir), { recursive: true })
        .map(String)
        .filter(file => !file.split(path.sep).includes('node_modules'))
        .filter(file => pattern.test(file))
        .map(file => path.join(dir, file));
}

const hasSource = (spec: EnvSpec, source: EnvSource): boolean =>
    spec.sources.includes(source);
const hasReader = (spec: EnvSpec, reader: EnvReader): boolean =>
    spec.readBy.includes(reader);
const namesWhere = (predicate: (spec: EnvSpec) => boolean): readonly string[] =>
    registry.filter(predicate).map(spec => spec.name);

/** 해석 못 하는 `process.env[expr]`를 가져도 되는 파일: 키를 인자로 받는 상한 읽기 헬퍼. 호출부는 `readPositiveBound('X'`로 스캔한다. */
const DYNAMIC_READER_HELPERS = [
    'cache-handler/boundedLru.mjs',
    'cache-handler/memStore.mjs',
];

/**
 * 앱 env가 아니다: 테스트 실행 환경에서만 읽는 CI 플래그. `src/__tests__` 안에서만 읽으므로
 * 스캐너가 보지 않고, 레지스트리에도 두지 않는다. 아래 테스트가 둘 다 확인한다.
 */
const TEST_ONLY_ENV = ['COVERAGE_RUN'];

/**
 * `.env.example`에 설명 줄이 없는 키와 이유. 개발자가 로컬에서 정하는 값이 아니거나(CI가 주입,
 * 운영 튜닝) 코드 기본값으로 충분한 값이다. 목록이 낡지 않도록 아래 테스트가 "여전히 레지스트리에
 * 있고 `.env.example`에 여전히 없다"를 확인한다 — 문서화하면 여기서 지운다.
 */
const ENV_EXAMPLE_UNDOCUMENTED: Readonly<Record<string, string>> = {
    ...Object.fromEntries(
        [
            'ISR_CACHE_DISABLED',
            'ISR_CACHE_MAX_INFLIGHT_UPLOADS',
            'ISR_FETCH_CACHE_DISABLED',
            'ISR_FETCH_CACHE_MAX_BYTES',
            'ISR_FETCH_CACHE_MAX_ENTRIES',
            'ISR_FETCH_CACHE_ROUTE_MAX_BYTES',
            'ISR_PAGE_CACHE_DISABLED',
            'ISR_PAGE_CACHE_MAX_BYTES',
            'ISR_PAGE_CACHE_MAX_ENTRIES',
            'ISR_PAGE_CACHE_TTL_MS',
            'ISR_TAG_SYNC_DISABLED',
        ].map(key => [
            key,
            'ISR cache tuning knob; defaults live in cache-handler, tuned only in SSM during an incident',
        ])
    ),
    DB_CONTENT_LOCALE: 'DB content sidecar switch, off by default',
    PLAIN_MODEL: 'plain-analysis model override, code default applies',
    FMP_AT_BUILD:
        'CI build policy from a repo variable, not a developer setting',
    GIT_SHA: 'injected by CI as the release version',
    NEXT_BUILD_DATE: 'injected by CI at build',
    PRERENDER_LOCALES: 'CI build setting from a repo variable',
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
        'optional Search Console token; deploy.yml passes none',
};

/**
 * Dockerfile `ARG`가 없는 빌드 타임 키와 이유(둘 다 아직 번들에 박히지 않는다).
 * - `PUBLIC_API_ENABLED`: 정적 페이지가 빌드 시점 값을 읽는데 build-arg가 없다. 공개 API를 켜는
 *   작업(WP-29)이 ARG와 deploy.yml build-arg를 더하면서 이 항목을 지우고 레지스트리 분류를 바꾼다.
 *   (지금 운영의 정적 출력은 SSM 값과 무관하게 항상 "꺼짐"이다.)
 * - `NEXT_PUBLIC_AI_SITE_URL`: 코드 기본값(https://ai.siglens.io)을 쓴다.
 */
const NO_DOCKERFILE_ARG: Readonly<Record<string, string>> = {
    PUBLIC_API_ENABLED:
        'read at build time for static pages but no build-arg exists; WP-29 adds it when the public API launches',
    NEXT_PUBLIC_AI_SITE_URL:
        'code default https://ai.siglens.io is used; no ARG is declared',
};

/** Dockerfile `ARG`는 있지만 deploy.yml이 `--build-arg`로 넘기지 않는 키와 이유. */
const NO_DEPLOY_BUILD_ARG: Readonly<Record<string, string>> = {
    ...NO_DOCKERFILE_ARG,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
        'optional token; deploy.yml does not pass it, so the metadata tag is omitted',
};

/** 배포 게이트가 막는 필수 SSM 키. 바꾸면 게이트 동작이 바뀌므로 의도한 변경인지 눈에 띄게 고정한다. */
const REQUIRED_SSM_KEYS = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_CHAT_API_KEY',
    'CRON_SECRET',
    'DATABASE_URL',
    'DATA_GO_KR_SERVICE_KEY',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_CHAT_API_KEY',
    'EMAIL_FROM',
    'EMAIL_REPORT_SIGNING_SECRET',
    'FMP_API_KEY',
    'GEMINI_API_KEY',
    'GEMINI_CHAT_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'ISR_CACHE_BUCKET',
    'LLM_API_KEY_ENCRYPTION_KEY',
    'NAVER_CLIENT_ID',
    'NAVER_CLIENT_SECRET',
    'OAUTH_REDIRECT_BASE_URL',
    'OAUTH_STATE_HMAC_SECRET',
    'OAUTH_TOKEN_ENCRYPTION_KEY',
    'OPENAI_API_KEY',
    'OPENAI_CHAT_API_KEY',
    'RESEND_API_KEY',
    'TRANSLATE_MODEL',
    'UPSTASH_REDIS_REST_READONLY_TOKEN',
    'UPSTASH_REDIS_REST_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'VISITOR_HASH_PEPPER',
];

/** 주입받은 맵을 쓰는 파일: 기본 매개변수 `process.env`와 `env.X` 읽기를 허용한다(`EnvScanOptions`). */
const INJECTED_ENV_FILES = ['src/app/api/ai/chat/counters.ts'];

const appReads = scanEnvReads(
    ROOT,
    ['src', 'cache-handler', 'next.config.ts'],
    INJECTED_ENV_FILES
);

/** 키 이름 그대로의 단어 경계 매칭(`FOO`가 `FOO_BAR`나 `XFOO` 안에서 걸리지 않게). */
const mentions = (text: string, key: string): boolean =>
    new RegExp(`\\b${key}\\b`).test(text);

describe('레지스트리 형태', () => {
    it('이름이 중복되지 않는다', () => {
        expect(byName.size).toBe(registry.length);
    });

    it('이름은 대문자 스네이크 케이스이고 note는 한 줄이다', () => {
        const bad = registry.filter(
            spec => !/^[A-Z][A-Z0-9_]*$/.test(spec.name) || /\n/.test(spec.note)
        );
        expect(bad.map(spec => spec.name)).toEqual([]);
    });

    it('모든 키는 운영 경로와 읽는 쪽을 하나 이상 가진다', () => {
        const bad = registry.filter(
            spec => spec.sources.length === 0 || spec.readBy.length === 0
        );
        expect(bad.map(spec => spec.name)).toEqual([]);
    });

    // 손으로 적은 목록을 일부러 레지스트리와 따로 둔다. 레지스트리에서 파생하면 키를 추가·삭제해도
    // 테스트가 같이 움직여 아무것도 못 잡는다. 필수 키가 바뀌면 배포 게이트가 막는 대상이 바뀐다는
    // 뜻이므로, 이 목록을 함께 고치는 것이 "의도한 변경"의 서명이다.
    it('필수 SSM 키 집합은 의도해서만 바뀐다', () => {
        expect(
            namesWhere(
                spec =>
                    spec.requirement === 'required' && hasSource(spec, 'ssm')
            ).toSorted()
        ).toEqual(REQUIRED_SSM_KEYS.toSorted());
    });

    it('required는 SSM 키에만 쓴다(다른 경로는 게이트가 보지 않는다)', () => {
        const bad = registry.filter(
            spec => spec.requirement === 'required' && !hasSource(spec, 'ssm')
        );
        expect(bad.map(spec => spec.name)).toEqual([]);
    });

    it('NEXT_PUBLIC_ 키는 런타임 SSM으로 받지 않는다(클라이언트 번들은 빌드 때 굳는다)', () => {
        const bad = registry.filter(
            spec =>
                spec.name.startsWith('NEXT_PUBLIC_') && hasSource(spec, 'ssm')
        );
        expect(bad.map(spec => spec.name)).toEqual([]);
    });

    it('NEXT_PUBLIC_ 키는 build-arg이거나 로컬 전용이다', () => {
        const bad = registry.filter(
            spec =>
                spec.name.startsWith('NEXT_PUBLIC_') &&
                !hasSource(spec, 'build-arg') &&
                !(spec.sources.length === 1 && hasSource(spec, 'local'))
        );
        expect(bad.map(spec => spec.name)).toEqual([]);
    });

    it('ALARM_EMAIL은 인프라 전용이라 SSM 게이트 대상이 아니다', () => {
        const spec = byName.get('ALARM_EMAIL');
        expect(spec?.readBy).toEqual(['infra']);
        expect(spec?.sources).not.toContain('ssm');
    });
});

describe('G1 코드가 읽는 키는 모두 등록돼 있다', () => {
    it('src/, cache-handler/, next.config.ts의 모든 읽기가 레지스트리에 있다', () => {
        const missing = [...appReads.reads.keys()].filter(
            key => !byName.has(key)
        );
        expect(missing).toEqual([]);
    });

    it('해석 못 하는 process.env[expr]는 키를 인자로 받는 헬퍼에만 있다', () => {
        expect(appReads.unresolved.toSorted()).toEqual(
            [...DYNAMIC_READER_HELPERS].toSorted()
        );
    });

    it('헬퍼 호출부는 키를 리터럴로 넘겨 스캔에 잡힌다(readPositiveBound)', () => {
        const fromCacheHandler = [...appReads.reads.entries()]
            .filter(([, files]) =>
                files.some(file => file.startsWith('cache-handler/'))
            )
            .map(([key]) => key);

        expect(fromCacheHandler).toEqual(
            expect.arrayContaining([
                'ISR_FETCH_CACHE_MAX_ENTRIES',
                'ISR_PAGE_CACHE_TTL_MS',
                'ISR_CACHE_MAX_INFLIGHT_UPLOADS',
            ])
        );
    });

    it('테스트 전용 env는 앱 코드가 읽지 않고 레지스트리에도 없다', () => {
        TEST_ONLY_ENV.forEach(key => {
            expect(byName.has(key)).toBe(false);
            expect(appReads.reads.has(key)).toBe(false);
        });
    });
});

describe('스캐너', () => {
    it('process.env.X, process.env[리터럴], env.X, 상수 경유, readPositiveBound를 모두 잡는다', () => {
        const scanned = scanEnvSource(
            `
            const NAME_ENV = 'VIA_CONST';
            const a = process.env.DIRECT_ONE;
            const b = process.env['BRACKET_ONE'];
            const c = process.env[NAME_ENV];
            const d = env.INJECTED_ONE;
            const e = readPositiveBound(
                'BOUND_ONE',
                1
            );
        `,
            { injectedEnv: true }
        );

        expect(scanned.keys.toSorted()).toEqual([
            'BOUND_ONE',
            'BRACKET_ONE',
            'DIRECT_ONE',
            'INJECTED_ONE',
            'VIA_CONST',
        ]);
        expect(scanned.hasUnresolved).toBe(false);
    });

    it('주석 안의 process.env는 세지 않는다', () => {
        const scanned = scanEnvSource(`
            // process.env.LINE_COMMENT
            /* process.env.BLOCK_COMMENT */
            const a = process.env.REAL_ONE;
        `);

        expect(scanned.keys).toEqual(['REAL_ONE']);
        expect(scanned.hasUnresolved).toBe(false);
    });

    // 알아보지 못하는 읽기는 조용히 넘기지 않고 unresolved로 닫는다(fail closed). 아래는 한 형태씩.
    it.each([
        [
            'process.env[name] (해석 불가 식별자)',
            'const v = process.env[name];',
        ],
        [
            'process.env[`${p}_X`] (템플릿 보간)',
            'const v = process.env[`${p}_X`];',
        ],
        ['process.env[MAP[p]] (중첩 접근)', 'const v = process.env[MAP[p]];'],
        [
            'process.env[cfg.name] (속성 접근)',
            'const v = process.env[cfg.name];',
        ],
        ['const { X } = process.env (구조 분해)', 'const { X } = process.env;'],
        [
            'const e = process.env (별칭)',
            'const e = process.env;\nconst v = e.X;',
        ],
        ['f(process.env) (인자 전달)', 'run(process.env);'],
        [
            'process.env.lower (대문자 키가 아님)',
            'const v = process.env.lower;',
        ],
        [
            '상수가 대문자 키가 아닐 때',
            "const N = 'not a key';\nconst v = process.env[N];",
        ],
    ])('%s는 unresolved다', (_label, source) => {
        expect(scanEnvSource(source).hasUnresolved).toBe(true);
    });

    it.each([
        ['process.env["X"] (큰따옴표)', 'const v = process.env["DQ_KEY"];'],
        [
            'process.env[`X`] (보간 없는 백틱)',
            'const v = process.env[`TPL_KEY`];',
        ],
        ['process.env?.X (옵셔널 체이닝)', 'const v = process.env?.OPT_KEY;'],
        ['process.env?.["X"]', 'const v = process.env?.["OPT_BRACKET"];'],
        [
            '큰따옴표 상수 경유',
            'const N = "DQ_CONST";\nconst v = process.env[N];',
        ],
        ['줄바꿈이 낀 접근', 'const v = process.env\n    .NL_KEY;'],
    ])('%s는 키로 읽힌다', (_label, source) => {
        const scanned = scanEnvSource(source);

        expect(scanned.hasUnresolved).toBe(false);
        expect(scanned.keys).toHaveLength(1);
    });

    it('옵셔널 체이닝·큰따옴표·백틱은 정확한 키 이름을 돌려준다', () => {
        expect(
            scanEnvSource(
                'process.env?.A_KEY; process.env["B_KEY"]; process.env[`C_KEY`];'
            ).keys
        ).toEqual(['A_KEY', 'B_KEY', 'C_KEY']);
    });

    it('주입 맵 허용 파일에서만 값 위치 process.env와 env[...]를 받아들인다', () => {
        const source =
            'function f(env = process.env) { return env["INJ_BRACKET"] ?? env.INJ_DOT; }';

        expect(scanEnvSource(source).hasUnresolved).toBe(true);
        const allowed = scanEnvSource(source, { injectedEnv: true });
        expect(allowed.hasUnresolved).toBe(false);
        expect(allowed.keys.toSorted()).toEqual(['INJ_BRACKET', 'INJ_DOT']);
    });

    it('주입 맵 허용 파일에서도 해석 못 하는 env[expr]는 unresolved다', () => {
        expect(
            scanEnvSource('const v = env[name];', { injectedEnv: true })
                .hasUnresolved
        ).toBe(true);
    });

    it('readPositiveBound는 따옴표 리터럴 호출만 키로 읽고, 큰따옴표도 받는다', () => {
        const scanned = scanEnvSource(
            `readPositiveBound('SQ_KEY', 1); readPositiveBound("DQ_KEY", 2);`
        );

        expect(scanned.keys).toEqual(['SQ_KEY', 'DQ_KEY']);
        expect(scanned.hasUnresolved).toBe(false);
    });

    it.each([
        ['변수 인자', 'readPositiveBound(name, 1);'],
        ['템플릿 인자', 'readPositiveBound(`${p}_X`, 1);'],
        ['소문자 리터럴', "readPositiveBound('lower', 1);"],
        [
            '리터럴 호출 옆의 변수 호출',
            "readPositiveBound('OK_KEY', 1); readPositiveBound(other, 2);",
        ],
    ])('readPositiveBound의 %s는 unresolved다', (_label, source) => {
        expect(scanEnvSource(source).hasUnresolved).toBe(true);
    });

    it('readPositiveBound 정의(function)는 호출로 세지 않는다', () => {
        const scanned = scanEnvSource(
            "function readPositiveBound(name, fallback) { return fallback; }\nreadPositiveBound('DEF_OK', 1);"
        );

        expect(scanned.keys).toEqual(['DEF_OK']);
        expect(scanned.hasUnresolved).toBe(false);
    });

    it('주입 맵 허용 파일도 기본 매개변수 외의 값 위치 process.env는 잡는다', () => {
        const defaultOnly =
            'function f(env = process.env) { return env.INJ_KEY; }';
        const withDestructure = `${defaultOnly}\nconst { LEAK } = process.env;`;
        const withAlias = `${defaultOnly}\nconst e = process.env;`;

        expect(
            scanEnvSource(defaultOnly, { injectedEnv: true }).hasUnresolved
        ).toBe(false);
        expect(
            scanEnvSource(withDestructure, { injectedEnv: true }).hasUnresolved
        ).toBe(true);
        expect(
            scanEnvSource(withAlias, { injectedEnv: true }).hasUnresolved
        ).toBe(true);
    });

    it('객체 속성 config.env.X나 소문자 env.x는 키로 보지 않는다', () => {
        const scanned = scanEnvSource(
            'const a = config.env.SOMETHING; const b = env.lower;',
            { injectedEnv: true }
        );

        expect(scanned.keys).toEqual([]);
        expect(scanned.hasUnresolved).toBe(false);
    });
});

describe('G2 등록된 키는 실제로 읽힌다', () => {
    it('siglens가 읽는다고 적은 키는 앱 코드에서 실제로 읽힌다', () => {
        const unread = namesWhere(spec => hasReader(spec, 'siglens')).filter(
            key => !appReads.reads.has(key)
        );
        expect(unread).toEqual([]);
    });

    it('앱 코드가 읽는 키는 readBy에 siglens가 있다', () => {
        const wrong = [...appReads.reads.keys()].filter(key => {
            const spec = byName.get(key);
            return spec === undefined || !hasReader(spec, 'siglens');
        });
        expect(wrong).toEqual([]);
    });

    const CORE_DIST = 'node_modules/@y0ngha/siglens-core/dist';
    /**
     * core가 키 이름을 맵(`ENV_BY_PROVIDER`)으로 들고 `process.env[envName]`로 읽는 유일한 파일.
     * 동적 읽기를 허용하는 대신 맵의 따옴표 값을 직접 뽑아 레지스트리와 대조한다.
     */
    const CORE_DYNAMIC_READER = `${CORE_DIST}/infrastructure/ai/serverKeys.js`;
    const coreFiles = filesUnder(CORE_DIST, /\.js$/).map(file => {
        const source = read(file);
        return { file, source, scan: scanEnvSource(source) };
    });
    const coreSource = coreFiles.map(({ source }) => source).join('\n');

    it('core가 읽는다고 적은 키는 설치된 core dist에 단어로 있다', () => {
        const absent = namesWhere(spec => hasReader(spec, 'core')).filter(
            key => !mentions(coreSource, key)
        );
        expect(coreSource.length).toBeGreaterThan(0);
        expect(absent).toEqual([]);
    });

    it('설치된 core dist가 process.env로 읽는 리터럴 키는 모두 core 읽기로 등록돼 있다', () => {
        const coreKeys = coreFiles.flatMap(({ scan }) => scan.keys);
        const unregistered = coreKeys.filter(key => {
            const spec = byName.get(key);
            return spec === undefined || !hasReader(spec, 'core');
        });
        expect(coreKeys.length).toBeGreaterThan(0);
        expect(unregistered).toEqual([]);
    });

    it('core dist의 동적 process.env[...] 읽기는 serverKeys.js 한 곳뿐이다', () => {
        expect(
            coreFiles.filter(({ scan }) => scan.hasUnresolved).map(f => f.file)
        ).toEqual([CORE_DYNAMIC_READER]);
    });

    it('serverKeys.js 맵의 키 이름은 모두 core 읽기로 등록돼 있다', () => {
        const reader = coreFiles.find(f => f.file === CORE_DYNAMIC_READER);
        const mapped = [
            ...(reader?.source.matchAll(/:\s*'([A-Z][A-Z0-9_]*)'/g) ?? []),
        ].map(match => match[1]);
        const unregistered = mapped.filter(key => {
            const spec = byName.get(key);
            return spec === undefined || !hasReader(spec, 'core');
        });
        expect(mapped.length).toBeGreaterThan(0);
        expect(unregistered).toEqual([]);
    });

    it('infra가 읽는다고 적은 키는 infra/aws, Dockerfile, deploy.yml 중 한 곳에 있다', () => {
        const infraSource = [
            ...filesUnder('infra/aws', /\.sh$/),
            'Dockerfile',
            '.github/workflows/deploy.yml',
        ]
            .map(file => read(file))
            .join('\n');
        const absent = namesWhere(spec => hasReader(spec, 'infra')).filter(
            key => !mentions(infraSource, key)
        );
        expect(absent).toEqual([]);
    });

    it('scripts가 읽는다고 적은 키는 db/ 또는 scripts/에 있다', () => {
        const scriptSource = [
            ...filesUnder('db', /\.(?:ts|mjs|sh)$/),
            ...filesUnder('scripts', /\.(?:ts|mjs|sh)$/),
        ]
            .map(file => read(file))
            .join('\n');
        const absent = namesWhere(spec => hasReader(spec, 'scripts')).filter(
            key => !mentions(scriptSource, key)
        );
        expect(absent).toEqual([]);
    });
});

describe('G3 .env.example', () => {
    const example = read('.env.example');
    const lines = example.split('\n');
    const active = lines.flatMap(
        line => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1] ?? []
    );
    const commented = lines.flatMap(
        line => /^#\s*([A-Z][A-Z0-9_]*)=/.exec(line)?.[1] ?? []
    );
    const documented = new Set([...active, ...commented]);

    it('설명 줄(활성·주석 처리 모두)의 키는 모두 레지스트리에 있다', () => {
        expect([...documented].filter(key => !byName.has(key))).toEqual([]);
    });

    it('SSM·빌드 경로 키는 .env.example에 있다(예외 목록 제외)', () => {
        const missing = namesWhere(
            spec =>
                hasSource(spec, 'ssm') ||
                hasSource(spec, 'build-arg') ||
                hasSource(spec, 'build-secret')
        ).filter(
            key => !documented.has(key) && !(key in ENV_EXAMPLE_UNDOCUMENTED)
        );
        expect(missing).toEqual([]);
    });

    it('필수 SSM 키는 활성 줄이다(주석 처리돼 있으면 04-params가 적재하지 않는다)', () => {
        const notActive = namesWhere(
            spec => spec.requirement === 'required'
        ).filter(key => !active.includes(key));
        expect(notActive).toEqual([]);
    });

    it('예외 목록은 낡지 않았다: 등록돼 있고 .env.example에는 여전히 없다', () => {
        const stale = Object.keys(ENV_EXAMPLE_UNDOCUMENTED).filter(
            key => !byName.has(key) || documented.has(key)
        );
        expect(stale).toEqual([]);
    });

    it('MIGRATION_GATE는 주석 처리된 설명 줄이다(SSM 전용 선택 키)', () => {
        expect(commented).toContain('MIGRATION_GATE');
        expect(active).not.toContain('MIGRATION_GATE');
        expect(byName.get('MIGRATION_GATE')?.sources).toEqual(['ssm']);
        expect(byName.get('MIGRATION_GATE')?.requirement).toBe('override');
    });
});

describe('G4 배포 게이트 목록', () => {
    it('커밋된 infra/aws/env-gate.txt는 레지스트리에서 생성한 것과 같다 — 어긋나면 yarn env:gate', () => {
        expect(read('infra/aws/env-gate.txt')).toBe(renderEnvGate(registry));
    });

    it('게이트 필수 줄은 레지스트리 필수 SSM 키와 같다', () => {
        const required = read('infra/aws/env-gate.txt')
            .split('\n')
            .flatMap(line => /^required (\S+)$/.exec(line)?.[1] ?? []);
        expect(required.toSorted()).toEqual(REQUIRED_SSM_KEYS.toSorted());
    });
});

describe('G6 빌드 인자', () => {
    const dockerfile = read('Dockerfile');
    const deploy = read('.github/workflows/deploy.yml');
    const dockerArgs = new Set(
        [...dockerfile.matchAll(/^\s*ARG ([A-Z][A-Z0-9_]*)/gm)].map(m => m[1])
    );
    const deployArgs = new Set(
        [...deploy.matchAll(/--build-arg ([A-Z][A-Z0-9_]*)=/g)].map(m => m[1])
    );
    const buildArgKeys = namesWhere(spec => hasSource(spec, 'build-arg'));
    const secretKeys = namesWhere(spec => hasSource(spec, 'build-secret'));
    const dockerSecrets = [
        ...dockerfile.matchAll(/type=secret,id=([A-Z][A-Z0-9_]*)/g),
    ].map(m => m[1]);
    const deploySecrets = [
        ...deploy.matchAll(/--secret id=([A-Z][A-Z0-9_]*)/g),
    ].map(m => m[1]);

    it('Dockerfile ARG는 모두 등록된 build-arg 키다', () => {
        expect(
            [...dockerArgs].filter(arg => !buildArgKeys.includes(arg))
        ).toEqual([]);
    });

    it('deploy.yml --build-arg는 모두 등록된 build-arg 키이고 Dockerfile ARG로 받는다', () => {
        expect(deployArgs.size).toBeGreaterThan(0);
        expect(
            [...deployArgs].filter(
                arg => !buildArgKeys.includes(arg) || !dockerArgs.has(arg)
            )
        ).toEqual([]);
    });

    it('등록된 build-arg 키는 Dockerfile ARG가 있다(알려진 예외 제외)', () => {
        expect(
            buildArgKeys.filter(
                key => !dockerArgs.has(key) && !(key in NO_DOCKERFILE_ARG)
            )
        ).toEqual([]);
    });

    it('등록된 build-arg 키는 deploy.yml이 넘긴다(알려진 예외 제외)', () => {
        expect(
            buildArgKeys.filter(
                key => !deployArgs.has(key) && !(key in NO_DEPLOY_BUILD_ARG)
            )
        ).toEqual([]);
    });

    it('예외 목록은 낡지 않았다: 빠져 있던 ARG·build-arg가 생기면 여기서 지운다', () => {
        const staleDocker = Object.keys(NO_DOCKERFILE_ARG).filter(
            key => !byName.has(key) || dockerArgs.has(key)
        );
        const staleDeploy = Object.keys(NO_DEPLOY_BUILD_ARG).filter(
            key => !byName.has(key) || deployArgs.has(key)
        );
        expect(staleDocker).toEqual([]);
        expect(staleDeploy).toEqual([]);
    });

    it('빌드 시크릿은 모두 등록된 build-secret 키다', () => {
        expect(
            [...dockerSecrets, ...deploySecrets].filter(
                id => !secretKeys.includes(id)
            )
        ).toEqual([]);
    });

    it('등록된 build-secret 키는 deploy.yml이 넘기고 Dockerfile이 마운트한다', () => {
        expect(secretKeys.filter(key => !deploySecrets.includes(key))).toEqual(
            []
        );
        expect(secretKeys.filter(key => !dockerSecrets.includes(key))).toEqual(
            []
        );
    });
});
