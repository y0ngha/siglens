import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 루트 레이아웃이 모든 페이지에 싣는 클라이언트 JS에 `@y0ngha/siglens-core`가 들어가지 않는다.
 *
 * core는 CommonJS 한 덩어리라 값 하나만 import해도 번들러가 통째로 싣는다(원본 185KB,
 * 전송 ~51KB). 2026-10-05 JS 커버리지 실측에서 이 청크가 홈·소개·시장 페이지에도 실려
 * 있었고 홈에서 99%가 쓰이지 않았다. 원인은 루트 레이아웃의 종목 진입 골격이 같은 파일의
 * 모델 선택 프로바이더를 거쳐 core를 끌어온 것이었다(`SymbolLayoutJail` 분리로 해결).
 *
 * 이 가드는 루트 레이아웃에서 시작해 **정적 import만** 따라가며(`next/dynamic`의 지연
 * import는 별도 청크라 제외) 클라이언트 경계(`'use client'`) 안쪽 파일이 core에서 값을
 * import하는지 본다. 서버 컴포넌트와 Server Action(`'use server'`)은 클라이언트 번들에
 * 코드가 실리지 않으므로 대상이 아니다. 실제 번들 대신 소스를 보는 이유는 단위 테스트
 * 단계에서 빌드 없이 잡기 위해서다.
 */

const SRC = path.resolve(__dirname, '../..');
const ROOT_LAYOUT = path.join(SRC, 'app/[locale]/layout.tsx');

// `import … from`, 부수효과 import, 그리고 재노출(`export … from`)까지 의존으로 본다 —
// 재노출 한 단계를 거쳐 core가 들어오는 경로도 같은 무게를 싣는다.
const IMPORT_RE =
    /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*'([^']+)'|import\s*'([^']+)'/g;

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

interface Offender {
    file: string;
    chain: string[];
}

function findCoreInClientGraph(entry: string): Offender[] {
    const offenders: Offender[] = [];
    const visited = new Set<string>();
    const walk = (file: string, inClient: boolean, chain: string[]): void => {
        const key = `${file}|${inClient}`;
        if (visited.has(key)) return;
        visited.add(key);
        const source = readFileSync(file, 'utf8');
        const kind = directive(source);
        if (kind === 'server') return;
        const client = inClient || kind === 'client';
        for (const match of source.matchAll(IMPORT_RE)) {
            const spec = match[3] ?? match[4];
            if (!spec || isTypeOnly(match[1], match[2] ?? '')) continue;
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

describe('루트 레이아웃 클라이언트 번들', () => {
    it('@y0ngha/siglens-core를 정적으로 끌어오지 않는다', () => {
        const offenders = findCoreInClientGraph(ROOT_LAYOUT);
        expect(
            offenders.map(o => o.chain.join(' → ')),
            '이 경로의 core 값 import를 지연 로드(next/dynamic)하거나 파일을 나눠 루트 레이아웃 그래프 밖으로 빼야 한다'
        ).toEqual([]);
    });

    it('검출기가 실제로 잡는다 — 분리 전 경로라면 걸린다', () => {
        // jail과 프로바이더가 한 파일이던 때의 경로를 그대로 재현한다.
        const providers = path.join(
            SRC,
            'app/[locale]/[symbol]/SymbolLayoutClient.tsx'
        );
        expect(findCoreInClientGraph(providers).length).toBeGreaterThan(0);
    });
});
