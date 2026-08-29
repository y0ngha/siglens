import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * **`'use client'` 파일은 서버 전용 모듈을 끌고 오는 배럴을 import하지 않는다.**
 *
 * `@/entities/auth` 배럴은 `verifyEmail → tokenUtils → node:crypto`로 이어진다.
 * 클라이언트 컴포넌트가 그 배럴에서 상수 하나만 가져와도 Turbopack이 전체
 * 그래프를 클라이언트 번들에 넣으려 하고 **빌드가 깨진다**.
 *
 * 실제로 그렇게 냈다: `LoginForm`이 에러 코드 표를 `@/entities/auth`에서 가져오자
 * `yarn build`가 `Ecmascript file had an error`로 죽었다. tsc·lint·11,000개
 * 테스트는 전부 통과했다 — 번들러만 아는 결함이라 빌드까지 가야 보인다.
 * v0.58.0의 "서버 SDK가 클라 번들로 새던 배럴 누출"과 같은 결함군이다.
 *
 * 이 가드는 그걸 **빌드 전에** 잡는다. 빌드는 4분, 이 테스트는 1초다.
 */
describe("'use client' 파일은 서버 전용 배럴을 import하지 않는다", () => {
    const sources = execSync(
        `find ${JSON.stringify(`${ROOT}/src`)} -name '*.ts' -o -name '*.tsx'`,
        { encoding: 'utf8', maxBuffer: 1 << 28 }
    )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(f => f.replace(`${ROOT}/`, ''))
        .filter(rel => !rel.includes('__tests__'));

    /** Node 전용 API를 쓰는 모듈. 이게 클라이언트 그래프에 들어가면 안 된다. */
    const SERVER_ONLY =
        /from '(?:node:)?(?:crypto|fs|path|net|dns|child_process)'/;

    const readCode = (rel: string) => readFileSync(`${ROOT}/${rel}`, 'utf8');

    /** 모듈 그래프(상대·별칭 import만). */
    const graph = new Map<string, string[]>();
    for (const rel of sources) {
        /**
         * `import type`은 컴파일 시 지워지므로 번들 그래프에 남지 않는다.
         * 포함하면 타입 전용 모듈(`shared/db/types.ts` 등)이 전부 오탐이 된다.
         */
        const code = readCode(rel)
            // 주석부터 지운다 — `entities/ticker/index.ts`의 "Do NOT re-export
            // anything from './api'" 같은 **주석 속 경로**를 import로 오인하면
            // 존재하지 않는 간선이 생겨 오탐이 난다.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            // 여러 줄에 걸친 `import type { … } from '…'`도 지운다 — 한 줄
            // 가정만 두면 그 형태가 그래프에 남아 오탐이 된다.
            .replace(/^import type [\s\S]*?from '[^']+';$/gm, '')
            // `export type { … } from '…'`도 컴파일 시 지워진다 — 배럴이
            // 타입만 재수출하는 경우가 흔하다(`entities/inquiry/index.ts`).
            .replace(/^export type \{[\s\S]*?\} from '[^']+';$/gm, '');
        graph.set(
            rel,
            [...code.matchAll(/(?<!import type )from\s+'([^']+)'/g)].map(
                m => m[1]!
            )
        );
    }

    const resolve = (from: string, spec: string): string | null => {
        let base: string;
        if (spec.startsWith('@/')) {
            base = `src/${spec.slice(2)}`;
        } else if (spec.startsWith('.')) {
            const dir = from.slice(0, from.lastIndexOf('/'));
            const parts: string[] = [];
            for (const seg of `${dir}/${spec}`.split('/')) {
                if (seg === '.' || seg === '') continue;
                if (seg === '..') parts.pop();
                else parts.push(seg);
            }
            base = parts.join('/');
        } else {
            return null;
        }
        for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
            if (graph.has(base + ext)) return base + ext;
        }
        return graph.has(base) ? base : null;
    };

    /** `rel`에서 도달 가능한 서버 전용 모듈의 첫 경로. */
    const serverOnlyPath = (rel: string): string[] | null => {
        const seen = new Set<string>();
        const stack: Array<[string, string[]]> = [[rel, [rel]]];
        while (stack.length > 0) {
            const [cur, path] = stack.pop()!;
            if (seen.has(cur)) continue;
            seen.add(cur);
            const code = readCode(cur);
            /**
             * `'use server'`는 **번들 경계**다 — 그 아래 그래프는 클라이언트로
             * 넘어가지 않고 RPC 스텁만 남는다. 여기서 멈추지 않으면 서버 액션을
             * 부르는 모든 클라이언트 컴포넌트가 오탐으로 잡힌다.
             */
            if (path.length > 1 && code.startsWith("'use server'")) continue;
            /**
             * `import 'server-only'`는 경계가 **아니라 표지**다 — 클라이언트
             * 그래프에 들어가면 빌드가 깨진다. 그래서 여기 도달했다는 것 자체가
             * 위반이고, `node:crypto` 여부와 무관하게 잡아야 한다.
             *
             * (처음엔 이걸 경계로 오해해 `continue`했고, 그 탓에 실제 결함을
             * 재현한 변이가 통과했다.)
             */
            if (path.length > 1 && /import 'server-only'/.test(code)) {
                return path;
            }
            if (path.length > 1 && SERVER_ONLY.test(code)) return path;
            for (const spec of graph.get(cur) ?? []) {
                const next = resolve(cur, spec);
                if (next) stack.push([next, [...path, next]]);
            }
        }
        return null;
    };

    it('위반이 없다', () => {
        const clientFiles = sources.filter(rel =>
            readCode(rel).startsWith("'use client'")
        );
        // 스캔이 헛돌지 않는지 — 클라이언트 파일이 0건이면 이 가드가 무의미하다.
        expect(clientFiles.length).toBeGreaterThan(20);

        const offenders = clientFiles.flatMap(rel => {
            const path = serverOnlyPath(rel);
            return path === null ? [] : [path.join(' → ')];
        });

        expect(offenders).toEqual([]);
    });
});
