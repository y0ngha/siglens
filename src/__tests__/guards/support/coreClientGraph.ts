import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 클라이언트 번들에 `@y0ngha/siglens-core`가 실리는 import 경로를 찾는 소스 워커.
 *
 * core는 CommonJS 한 덩어리라 값 하나만 import해도 번들러가 통째로 싣는다(원본 185KB,
 * 전송 ~51KB). 진입 파일에서 import를 따라가며 클라이언트 경계(`'use client'`) 안쪽
 * 파일이 core에서 **값**을 import하는지 본다. 서버 컴포넌트와 Server Action
 * (`'use server'`)은 클라이언트 번들에 코드가 실리지 않으므로 대상이 아니다. 실제 번들
 * 대신 소스를 보는 이유는 단위 테스트 단계에서 빌드 없이 잡기 위해서다.
 *
 * 루트 레이아웃 가드(`rootLayoutCoreFree`)와 ai 채팅 가드(`aiChatCoreFree`)가 같은
 * 판정을 써야 하므로 여기 한 벌만 둔다.
 */

export const SRC = path.resolve(__dirname, '../../..');

// `import … from`, 부수효과 import, 그리고 재노출(`export … from`)까지 의존으로 본다 —
// 재노출 한 단계를 거쳐 core가 들어오는 경로도 같은 무게를 싣는다.
const IMPORT_RE =
    /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*'([^']+)'|import\s*'([^']+)'/g;

/** `import('...')` — `next/dynamic`·`React.lazy`의 지연 청크. */
const DYNAMIC_IMPORT_RE = /\bimport\(\s*'([^']+)'\s*\)/g;

function resolveSpecifier(spec: string, from: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith('.'))
        base = path.resolve(path.dirname(from), spec);
    else return null;
    const candidates = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(
        ext => base + ext
    );
    return (
        candidates.find(file => existsSync(file) && /\.(ts|tsx)$/.test(file)) ??
        null
    );
}

/** `import { type A, type B }`처럼 전부 타입이면 값 import가 아니다. */
function isTypeOnly(typeKeyword: string | undefined, clause: string): boolean {
    if (typeKeyword) return true;
    const trimmed = clause.trim();
    if (!trimmed.startsWith('{')) return false;
    return trimmed
        .replace(/[{}]/g, '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .every(part => part.startsWith('type '));
}

function directive(source: string): 'client' | 'server' | null {
    // 지시문 앞의 주석은 건너뛴다(지시문은 첫 문장이어야 하지만 주석은 앞에 올 수 있다).
    const head = source
        .replace(/^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*/, '')
        .trimStart()
        .slice(0, 20);
    if (head.startsWith("'use client'")) return 'client';
    if (head.startsWith("'use server'")) return 'server';
    return null;
}

export interface CoreOffender {
    file: string;
    chain: string[];
}

export interface CoreClientGraphOptions {
    /**
     * `import('...')`(지연 청크)도 따라간다. 루트 레이아웃 가드는 "첫 로드에 실리는가"를
     * 보므로 끄고, 화면 전체가 core를 싣지 않아야 하는 가드(ai 채팅)는 켠다 — 지연
     * 청크도 그 화면을 쓰는 순간 내려받는다.
     */
    followDynamicImports?: boolean;
}

export function findCoreInClientGraph(
    entry: string,
    options: CoreClientGraphOptions = {}
): CoreOffender[] {
    const offenders: CoreOffender[] = [];
    const visited = new Set<string>();
    const walk = (file: string, inClient: boolean, chain: string[]): void => {
        const key = `${file}|${inClient}`;
        if (visited.has(key)) return;
        visited.add(key);
        const source = readFileSync(file, 'utf8');
        const kind = directive(source);
        if (kind === 'server') return;
        const client = inClient || kind === 'client';
        const specs: string[] = [];
        for (const match of source.matchAll(IMPORT_RE)) {
            const spec = match[3] ?? match[4];
            if (!spec || isTypeOnly(match[1], match[2] ?? '')) continue;
            specs.push(spec);
        }
        if (options.followDynamicImports)
            for (const match of source.matchAll(DYNAMIC_IMPORT_RE))
                specs.push(match[1]!);
        for (const spec of specs) {
            if (spec === '@y0ngha/siglens-core') {
                if (client) offenders.push({ file, chain });
                continue;
            }
            const next = resolveSpecifier(spec, file);
            if (next) walk(next, client, [...chain, path.relative(SRC, next)]);
        }
    };
    walk(entry, false, [path.relative(SRC, entry)]);
    return offenders;
}
