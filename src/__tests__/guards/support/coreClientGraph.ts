import path from 'node:path';

import { fileImports, SRC } from './importGraph';

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
 * 판정을 써야 하므로 여기 한 벌만 둔다. import 추출·해석과 지시문 판정은
 * `importGraph.ts`의 `fileImports`를 쓴다.
 */

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
        const { directive, imports } = fileImports(file);
        if (directive === 'use server') return;
        const client = inClient || directive === 'use client';
        // 동기 `require()`는 같은 청크에 실리므로 따라간다. 별도 청크는 `import()`뿐이다.
        const followed = imports.filter(
            ({ typeOnly, lazyChunk }) =>
                !typeOnly && (options.followDynamicImports || !lazyChunk)
        );
        for (const { specifier, resolved } of followed) {
            if (specifier === '@y0ngha/siglens-core') {
                if (client) offenders.push({ file, chain });
                continue;
            }
            if (typeof resolved === 'string')
                walk(resolved, client, [
                    ...chain,
                    path.relative(SRC, resolved),
                ]);
        }
    };
    walk(entry, false, [path.relative(SRC, entry)]);
    return offenders;
}
