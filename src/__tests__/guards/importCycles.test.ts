import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS } from './support/controlUsage';
import {
    buildImportGraph,
    cycleEdges,
    type ImportEdge,
    stronglyConnectedComponents,
} from './support/importGraph';

/**
 * **순환 import 회귀 가드.**
 *
 * 레이어 방향 규칙(oxlint `no-restricted-imports`)은 서로 다른 레이어 사이의
 * 순환만 막는다. 같은 레이어 안에서는 entities끼리·features끼리 cross-import를
 * 허용하므로(CLAUDE.md "Layer Dependency Rules") 순환이 생길 수 있는데, 지금까지
 * 그것을 보는 장치가 없었다.
 *
 * 두 단위로 본다.
 *
 * - **파일 단위 런타임 순환**: `import type`과 동적 `import()`를 뺀 그래프. 모듈
 *   평가 순서가 꼬여 TDZ·`undefined` import가 날 수 있는 순환이다.
 * - **슬라이스 단위 순환**(entities·features): 파일로는 순환이 아니어도 슬라이스끼리
 *   서로를 참조하면 둘을 따로 고치거나 옮길 수 없다. `import type`만 뺀다.
 *
 * 둘 다 **0건**이어야 통과한다. 허용 목록을 두지 않는다 — 순환이 생기면 그
 * 자리에서 끊는다(공용 코드를 아래 레이어나 별도 파일로 내리는 것이 보통의 해법이다).
 */

const runtimeStatic = (edge: ImportEdge): boolean =>
    !edge.typeOnly && !edge.dynamic;
const runtime = (edge: ImportEdge): boolean => !edge.typeOnly;

const fileKey = (file: string): string => file;

/** `entities/<slice>/…`·`features/<slice>/…` → `entities/<slice>`. 그 밖은 버린다. */
const sliceKey = (file: string): string | null => {
    const [layer, slice, rest] = file.split('/');
    if ((layer === 'entities' || layer === 'features') && slice && rest)
        return `${layer}/${slice}`;
    return null;
};

describe('순환 import', () => {
    it(
        '측정이 무너지지 않았다 — 내부 import가 전부 파일로 해석된다',
        () => {
            // 해석기가 깨지면 엣지가 사라지고 순환도 함께 사라져, 아래 가드가
            // "순환 없음"으로 통과한다. 해석 실패를 0으로 고정해 그 경로를 막는다.
            const { files, edges, unresolved } = buildImportGraph();
            expect(unresolved).toEqual([]);
            expect(files.length).toBeGreaterThan(0);
            expect(edges.length).toBeGreaterThan(files.length);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '파일 단위 런타임 순환이 없다',
        () => {
            const current = cycleEdges(
                buildImportGraph().edges.filter(runtimeStatic),
                fileKey
            );
            expect(current).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '슬라이스 단위 순환(entities·features)이 없다',
        () => {
            const current = cycleEdges(
                buildImportGraph().edges.filter(runtime),
                sliceKey
            );
            expect(current).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );
});

describe('순환 검출기', () => {
    const edge = (
        from: string,
        to: string,
        extra: Partial<ImportEdge> = {}
    ): ImportEdge => ({ from, to, typeOnly: false, dynamic: false, ...extra });

    it('세 파일 순환의 엣지를 모두 찾고, 순환 밖 엣지는 뺀다', () => {
        const edges = [
            edge('a.ts', 'b.ts'),
            edge('b.ts', 'c.ts'),
            edge('c.ts', 'a.ts'),
            edge('c.ts', 'd.ts'),
        ];
        expect(cycleEdges(edges, fileKey)).toEqual([
            'a.ts -> b.ts',
            'b.ts -> c.ts',
            'c.ts -> a.ts',
        ]);
    });

    it('type-only·동적 엣지를 걸러 낸 그래프에서는 순환이 사라진다', () => {
        const edges = [
            edge('a.ts', 'b.ts'),
            edge('b.ts', 'a.ts', { typeOnly: true }),
            edge('c.ts', 'd.ts'),
            edge('d.ts', 'c.ts', { dynamic: true }),
        ];
        expect(cycleEdges(edges.filter(runtimeStatic), fileKey)).toEqual([]);
        expect(cycleEdges(edges, fileKey)).toHaveLength(4);
    });

    it('슬라이스 단위로 묶으면 파일로는 순환이 아닌 상호 참조도 잡는다', () => {
        const edges = [
            edge('features/a/ui/A.tsx', 'features/b/lib/b.ts'),
            edge('features/b/ui/B.tsx', 'features/a/lib/a.ts'),
        ];
        expect(cycleEdges(edges, fileKey)).toEqual([]);
        expect(cycleEdges(edges, sliceKey)).toEqual([
            'features/a -> features/b',
            'features/b -> features/a',
        ]);
    });

    it('SCC는 크기 2 이상만 돌려준다(자기 자신만 있는 노드는 순환이 아니다)', () => {
        const adjacency = new Map([
            ['a', ['b']],
            ['b', ['a']],
            ['c', ['d']],
        ]);
        expect(stronglyConnectedComponents(adjacency)).toEqual([['a', 'b']]);
    });
});
