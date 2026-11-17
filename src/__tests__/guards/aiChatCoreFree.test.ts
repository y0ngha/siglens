import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findCoreInClientGraph } from './support/coreClientGraph';
import { SCAN_TIMEOUT_MS } from './support/controlUsage';
import { SRC } from './support/importGraph';

/**
 * ai 호스트(`ai.siglens.io`) 채팅 화면의 클라이언트 JS에 `@y0ngha/siglens-core`가
 * 들어가지 않는다.
 *
 * 예전에는 `MessageList`가 후속 질문 줄 나누기(`splitAgentFollowUps`) 하나 때문에 core를
 * 직접 import해, CommonJS 한 덩어리(전송 ~51KB)가 채팅 first-load JS에 통째로 실렸다.
 * 나누기는 이제 서버가 한다(SSE `done` 프레임의 `body`/`followUps`, 저장된 대화는
 * `toMessageView`). 이 가드는 그 상태가 되돌아가지 않게 막는다.
 *
 * 루트 레이아웃 가드와 달리 **지연 import(`next/dynamic`)도 따라간다** — 대화 본문과
 * 모바일 서랍은 지연 청크지만, 채팅을 쓰는 순간 내려받으므로 core가 거기 숨어도 같은
 * 비용이다.
 */

/**
 * 따라가지 않는 지연 청크. 답변 안 차트(`ChatChart` → `StockChart`)는 캔들 패턴 탐지·지표 상수·미국 장 달력을 core에서
 * 값으로 쓴다. 이 청크는 채팅 화면을 여는 것만으로는 내려받지 않고 **답변에 차트가 처음 나올 때** 내려받으므로
 * (`ChatChartProvider`가 `next/dynamic`으로만 연다), 채팅 first-load에는 core가 실리지 않는다. 그 경계가 정적
 * import로 바뀌면 이 예외가 걸리지 않아 아래 검사가 다시 잡는다.
 */
const ALLOWED_LAZY_CHUNKS = ['widgets/chart/ChatChart.tsx'];

const AI_ENTRIES = [
    'app/ai/[locale]/layout.tsx',
    'app/ai/[locale]/page.tsx',
    'app/ai/[locale]/c/[id]/page.tsx',
].map(entry => path.join(SRC, entry));

describe('ai 채팅 클라이언트 번들', () => {
    it.each(AI_ENTRIES.map(entry => [path.relative(SRC, entry), entry]))(
        '%s — 지연 청크까지 포함해 @y0ngha/siglens-core를 끌어오지 않는다',
        (_label, entry) => {
            const offenders = findCoreInClientGraph(entry, {
                followDynamicImports: true,
                allowedLazyChunks: ALLOWED_LAZY_CHUNKS,
            });
            expect(
                offenders.map(o => o.chain.join(' → ')),
                '클라이언트에서 core가 필요한 계산은 서버(라우트·Server Component·toMessageView)로 옮겨 결과만 넘겨야 한다'
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '허용한 지연 청크는 실제 파일이고, 진입점에서 지연 import로만 닿는다',
        () => {
            for (const chunk of ALLOWED_LAZY_CHUNKS)
                expect(existsSync(path.join(SRC, chunk))).toBe(true);
            // 허용을 빼고 다시 걸면 그 청크 때문에만 잡혀야 한다 — 허용이 실제로 쓰이는 예외라는 뜻이다.
            const offenders = AI_ENTRIES.flatMap(entry =>
                findCoreInClientGraph(entry, { followDynamicImports: true })
            );
            for (const chunk of ALLOWED_LAZY_CHUNKS)
                expect(offenders.some(o => o.chain.includes(chunk))).toBe(true);
            expect(
                offenders.every(o =>
                    ALLOWED_LAZY_CHUNKS.some(chunk => o.chain.includes(chunk))
                )
            ).toBe(true);
            // 정적 import로는 닿지 않는다(지연 청크를 따라가지 않으면 core가 없다).
            expect(
                AI_ENTRIES.flatMap(entry => findCoreInClientGraph(entry))
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    describe('검출기가 실제로 잡는다', () => {
        let dir: string;
        beforeAll(() => {
            dir = mkdtempSync(path.join(tmpdir(), 'ai-core-guard-'));
            writeFileSync(
                path.join(dir, 'Shell.tsx'),
                "'use client';\nimport dynamic from 'next/dynamic';\nconst Lazy = dynamic(() => import('./Lazy'));\nexport const Shell = Lazy;\n"
            );
            writeFileSync(
                path.join(dir, 'Lazy.tsx'),
                "'use client';\nimport { splitAgentFollowUps } from '@y0ngha/siglens-core';\nexport default splitAgentFollowUps;\n"
            );
            writeFileSync(
                path.join(dir, 'TypeOnly.tsx'),
                "'use client';\nimport type { AgentMessage } from '@y0ngha/siglens-core';\nexport type X = AgentMessage;\n"
            );
        });
        afterAll(() => rmSync(dir, { recursive: true, force: true }));

        it('지연 import 뒤에 숨은 core 값 import를 잡는다', () => {
            const entry = path.join(dir, 'Shell.tsx');
            expect(
                findCoreInClientGraph(entry, { followDynamicImports: true })
            ).toHaveLength(1);
            // 루트 레이아웃 가드 모드(정적 import만)에서는 지연 청크를 보지 않는다.
            expect(findCoreInClientGraph(entry)).toHaveLength(0);
        });

        it('타입 전용 import는 번들에 실리지 않으므로 잡지 않는다', () => {
            expect(
                findCoreInClientGraph(path.join(dir, 'TypeOnly.tsx'), {
                    followDynamicImports: true,
                })
            ).toHaveLength(0);
        });
    });
});
