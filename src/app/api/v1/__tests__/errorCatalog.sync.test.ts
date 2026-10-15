import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';

/**
 * `apiErrorCatalog`(OpenAPI 문서·`/developers`가 읽는 오류 코드 목록)가 `src/app/api/v1`의 실제 코드와
 * 어긋나지 않게 한다. 라우트·실행기의 소스에서 오류 코드 리터럴을 긁어 양방향으로 대조한다:
 * 소스가 내는데 카탈로그에 없는 코드(문서 누락)도, 카탈로그에만 있고 아무도 내지 않는 코드(거짓 문서)도 실패다.
 *
 * 긁는 형태(전부 코드를 **내보내는** 자리다 — 코드를 비교만 하는 자리는 포함하지 않는다):
 *  - `apiError(status, 'code'` · `fail(status, 'code'` · `errorBody('code'`
 *  - `code: 'code'`(결과 객체) — `ErrorCode` 유니온 선언(`| 'code'`)은 일부러 제외한다. 선언만 있고 안 내는 코드가 있을 수 있다
 *  - `TOOL_ERROR_MAPPING`의 키(실행기가 `{ error: '<code>' }`로 돌려주는 도메인 오류)
 */
const V1_DIR = join(process.cwd(), 'src/app/api/v1');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return entry.name === '__tests__' ? [] : sourceFiles(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

const CALL_PATTERNS = [
    /\b(?:apiError|fail)\(\s*[^,()]+,\s*'([a-z][a-z_]*)'/g,
    /\berrorBody\(\s*'([a-z][a-z_]*)'/g,
    /\bcode:\s*'([a-z][a-z_]*)'/g,
];

function emittedCodes(): Set<string> {
    const found = new Set<string>();
    for (const file of sourceFiles(V1_DIR)) {
        const text = readFileSync(file, 'utf8');
        for (const pattern of CALL_PATTERNS)
            for (const match of text.matchAll(pattern))
                found.add(match[1] as string);
        // 실행기 도메인 오류 맵: `    invalid_symbol: {\n        status:`
        for (const match of text.matchAll(
            /^\s{4}([a-z][a-z_]*):\s*\{\s*\n\s*status:/gm
        ))
            found.add(match[1] as string);
    }
    return found;
}

const documented = new Set(API_ERROR_DOCS.map(doc => doc.code));

describe('apiErrorCatalog vs the codes src/app/api/v1 emits', () => {
    const emitted = emittedCodes();

    it('scans a plausible set (a broken scanner would make the checks below vacuous)', () => {
        expect(emitted.size).toBeGreaterThan(15);
        for (const known of ['invalid_api_key', 'rate_limited', 'busy'])
            expect(emitted).toContain(known);
    });

    it('documents every code the routes and executors emit', () => {
        expect([...emitted].filter(code => !documented.has(code))).toEqual([]);
    });

    it('has no catalog entry that nothing emits', () => {
        expect([...documented].filter(code => !emitted.has(code))).toEqual([]);
    });

    it('lists each code once', () => {
        expect(documented.size).toBe(API_ERROR_DOCS.length);
    });
});
