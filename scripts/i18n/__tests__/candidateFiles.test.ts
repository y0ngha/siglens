import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { candidateFiles } from '../lib/scan.mjs';

/**
 * 추출 대상 목록에서 빠지는 폴더. 에이전트 도구(`src/features/agent-tools/`)는 모델에게 보내는 텍스트라
 * `src/app/api/`처럼 통째로 빠진다 — 도구가 `src/app/api/ai/chat/tools/`에서 옮겨 온 뒤에도 같은 범위를 유지한다.
 */
describe('candidateFiles', () => {
    const root = mkdtempSync(join(tmpdir(), 'i18n-candidates-'));
    const write = (rel: string) => {
        mkdirSync(join(root, dirname(rel)), { recursive: true });
        writeFileSync(join(root, rel), "export const text = '안녕하세요';\n");
    };
    write('src/features/agent-tools/server/tools/getQuote.ts');
    write('src/features/agent-tools/lib/truncate.ts');
    write('src/features/agent-tools/spec/agentToolSet.ts');
    write('src/app/api/ai/chat/stream/route.ts');
    write('src/features/watchlist/ui/WatchlistEmpty.tsx');

    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('에이전트 도구 슬라이스와 src/app/api는 빼고 다른 feature는 남긴다', () => {
        expect(candidateFiles(root)).toEqual([
            'src/features/watchlist/ui/WatchlistEmpty.tsx',
        ]);
    });
});
