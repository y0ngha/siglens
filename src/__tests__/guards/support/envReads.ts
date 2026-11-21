import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { blankComments } from './sourceScan';

/**
 * env 레지스트리 가드가 공유하는 **읽기 스캐너**. 코드는 `process.env.X`를 리터럴로 읽는다
 * (Next가 `NEXT_PUBLIC_*`를 인라인하려면 리터럴이어야 하고, `cache-handler/*.mjs`는 TS를 못
 * 불러온다). 그 리터럴 읽기를 모아 `envRegistry.ts`와 대조하는 것이 가드의 일이다.
 *
 * 인식하는 형태:
 * - `process.env.X`, `process.env['X']`
 * - `process.env[CONST]` — 같은 파일의 `const CONST = 'X'`로 해석한다
 * - `env.X` — `env: Record<string, string | undefined> = process.env`처럼 주입받은 맵
 * - `readPositiveBound('X', ...)` — cache-handler의 상한 읽기 헬퍼(내부는 `process.env[name]`)
 *
 * 해석 못 하는 `process.env[expr]`는 `unresolved`로 돌려준다. 호출부가 허용 목록에 없는
 * 파일이면 실패시킨다 — 조용히 못 보는 읽기가 없어야 가드가 의미 있다.
 */
export interface EnvScanResult {
    /** 키 → 그 키를 읽는 파일(저장소 루트 기준, `/` 구분) */
    readonly reads: ReadonlyMap<string, readonly string[]>;
    /** 해석할 수 없는 `process.env[expr]`를 가진 파일 */
    readonly unresolved: readonly string[];
}

const SOURCE_EXT = /\.(?:ts|tsx|mjs|js)$/;
const TEST_FILE = /\.test\.(?:ts|tsx)$/;
const KEY = '[A-Z][A-Z0-9_]*';

function listFiles(dir: string): readonly string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return entry.name === '__tests__' || entry.name === 'node_modules'
                ? []
                : listFiles(full);
        }
        return SOURCE_EXT.test(entry.name) && !TEST_FILE.test(entry.name)
            ? [full]
            : [];
    });
}

export interface EnvScanOptions {
    /**
     * 주입받은 맵을 쓰는 파일(`env: Record<string, string | undefined> = process.env`)에서만 켠다.
     * 기본 매개변수(`= process.env)`) 형태의 값 위치 `process.env`만 허용하고, 그 파일의 `env[...]`도 읽기로 해석한다.
     * 켜지 않은 파일에서 값 위치의 `process.env`는 어떤 키를 읽는지 알 수 없으므로 unresolved다.
     */
    readonly injectedEnv?: boolean;
}

/** `[`에 대응하는 `]` 바로 앞까지의 본문(중첩 대괄호를 센다). 닫히지 않으면 나머지 전부. */
function bracketBody(code: string, open: number): string {
    const end = code
        .slice(open + 1)
        .split('')
        .reduce(
            (acc, ch, index) => {
                if (acc.end !== -1) return acc;
                const depth =
                    acc.depth + (ch === '[' ? 1 : ch === ']' ? -1 : 0);
                return depth < 0
                    ? { depth, end: index }
                    : { depth, end: acc.end };
            },
            { depth: 0, end: -1 }
        ).end;
    return end === -1
        ? code.slice(open + 1)
        : code.slice(open + 1, open + 1 + end);
}

/**
 * 한 소스에서 읽는 키와, 해석 못 한 읽기 여부. 주석은 먼저 지운다.
 *
 * **닫힌 방향(fail closed)으로 짠다.** 알아보는 형태만 세고 나머지를 조용히 넘기면 가드가 못 보는
 * 읽기가 생긴다. 그래서 `process.env`를 만나는 곳마다 세 가지 중 하나여야 한다 — 키를 리터럴로 읽는
 * 점 접근, 리터럴(작은·큰따옴표·보간 없는 백틱) 또는 같은 파일 문자열 상수로 풀리는 대괄호 접근,
 * 아니면 `hasUnresolved`. 값 위치의 `process.env`(구조 분해, 별칭, 인자 전달)도 마찬가지다.
 */
export function scanEnvSource(
    source: string,
    options: EnvScanOptions = {}
): {
    readonly keys: readonly string[];
    readonly hasUnresolved: boolean;
} {
    const code = blankComments(source);
    const constants = new Map(
        [...code.matchAll(/\bconst\s+(\w+)\s*=\s*(['"])([^'"\n]*)\2/g)].map(
            m => [m[1], m[3]]
        )
    );
    const asKey = (value: string | undefined): string | undefined =>
        value !== undefined && new RegExp(`^${KEY}$`).test(value)
            ? value
            : undefined;

    const dot = [
        ...code.matchAll(/process\.env\s*(?:\?\.|\.)\s*([A-Za-z_]\w*)/g),
    ].map(m => asKey(m[1]));

    const prefix = options.injectedEnv
        ? String.raw`(?:process\.env|(?<![.\w])env)`
        : String.raw`process\.env`;
    const bracket = [
        ...code.matchAll(new RegExp(`${prefix}\\s*(?:\\?\\.)?\\s*\\[`, 'g')),
    ].map(m => {
        const body = bracketBody(code, (m.index ?? 0) + m[0].length - 1).trim();
        const literal = /^(['"`])([^'"`$\n]*)\1$/.exec(body);
        if (literal !== null) return asKey(literal[2]);
        return /^[A-Za-z_]\w*$/.test(body)
            ? asKey(constants.get(body))
            : undefined;
    });

    const injected = options.injectedEnv
        ? [
              ...code.matchAll(new RegExp(`(?<![.\\w])env\\.(${KEY})\\b`, 'g')),
          ].map(m => m[1])
        : [];
    // 정의(`function readPositiveBound(`)는 호출이 아니다. 호출마다 첫 인자가 따옴표 리터럴이어야 키를
    // 읽을 수 있다 — 하나라도 아니면(변수·식) 어떤 키인지 알 수 없으니 파일을 unresolved로 닫는다.
    const callCount = [...code.matchAll(/(?<!function\s+)readPositiveBound\(/g)]
        .length;
    const bound = [
        ...code.matchAll(
            new RegExp(`readPositiveBound\\(\\s*(['"])(${KEY})\\1`, 'g')
        ),
    ].map(m => m[2]);
    const boundAllLiteral = bound.length === callCount;

    // 주입 맵 허용 파일도 값 위치 process.env는 기본 매개변수(`= process.env)`) 한 형태만 허용한다.
    // 같은 파일에 구조 분해·별칭이 새로 생기면 여전히 잡는다.
    const valueScope = options.injectedEnv
        ? code.replace(/=\s*process\.env\s*\)/g, '')
        : code;
    const bareValue = /process\.env\b(?!\s*(?:\?\.|\.|\[))/.test(valueScope);

    const resolved = [...dot, ...bracket, ...injected, ...bound];
    return {
        keys: resolved.filter((key): key is string => key !== undefined),
        hasUnresolved:
            bareValue ||
            !boundAllLiteral ||
            dot.some(key => key === undefined) ||
            bracket.some(key => key === undefined),
    };
}

/** `roots`(디렉터리 또는 파일, 저장소 루트 기준)의 앱 코드 env 읽기. 테스트 파일은 제외한다. */
export function scanEnvReads(
    repoRoot: string,
    roots: readonly string[],
    /** `EnvScanOptions.injectedEnv`를 켤 파일(저장소 루트 기준) */
    injectedEnvFiles: readonly string[] = []
): EnvScanResult {
    const files = roots.flatMap(root => {
        const full = path.join(repoRoot, root);
        return SOURCE_EXT.test(root) ? [full] : listFiles(full);
    });
    const perFile = files.map(full => {
        const file = path.relative(repoRoot, full).split(path.sep).join('/');
        return {
            file,
            ...scanEnvSource(readFileSync(full, 'utf8'), {
                injectedEnv: injectedEnvFiles.includes(file),
            }),
        };
    });
    const reads = perFile.reduce((acc, { file, keys }) => {
        keys.forEach(key => acc.set(key, [...(acc.get(key) ?? []), file]));
        return acc;
    }, new Map<string, readonly string[]>());
    return {
        reads,
        unresolved: perFile.filter(p => p.hasUnresolved).map(p => p.file),
    };
}
