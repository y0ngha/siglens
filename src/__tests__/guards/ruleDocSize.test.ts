import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 규칙 문서는 에이전트가 한 번에 끝까지 읽을 수 있는 길이로 유지한다.
 *
 * 리뷰 에이전트·CI 리뷰 봇은 Read 도구로 규칙 문서를 통째로 읽는데, Read는 한 번에 2,000줄까지만
 * 돌려주고 잘렸다고 알려 주지 않는다. 문서가 그보다 길면 뒷부분 규칙이 리뷰에서 소리 없이 빠진다.
 * 끊어 읽으라고 지시하는 대신 문서를 주제별로 나눠 두고(`CONVENTIONS.md`·`REACT.md`·`SERVER.md`…),
 * 다시 커지면 여기서 막는다. 상한을 2,000보다 낮게 잡아 쪼갤 여유를 남긴다.
 */

const ROOT = path.resolve(__dirname, '../../..');
const MAX_LINES = 1500;

function ruleDocs(): string[] {
    const conventions = readdirSync(path.join(ROOT, 'docs/conventions'))
        .filter(name => name.endsWith('.md'))
        .map(name => `docs/conventions/${name}`);
    const layerDocs = readdirSync(path.join(ROOT, 'src'), {
        withFileTypes: true,
    })
        .filter(entry => entry.isDirectory())
        .map(entry => `src/${entry.name}/CLAUDE.md`)
        .filter(file => {
            try {
                readFileSync(path.join(ROOT, file));
                return true;
            } catch {
                return false;
            }
        });
    return [...conventions, ...layerDocs, 'CLAUDE.md', 'skills/CLAUDE.md'];
}

function lineCount(file: string): number {
    return readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
}

describe('rule document size', () => {
    it(`every rule document stays at or under ${MAX_LINES} lines`, () => {
        const oversized = ruleDocs()
            .map(file => ({ file, lines: lineCount(file) }))
            .filter(({ lines }) => lines > MAX_LINES)
            .map(({ file, lines }) => `${file}: ${lines} lines`);
        expect(oversized).toEqual([]);
    });

    it('scans the convention documents, so the check cannot pass vacuously', () => {
        expect(ruleDocs()).toEqual(
            expect.arrayContaining([
                'docs/conventions/CONVENTIONS.md',
                'docs/conventions/REACT.md',
                'docs/conventions/SERVER.md',
            ])
        );
    });
});
