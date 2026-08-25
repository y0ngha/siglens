import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';

import { sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * 공통 스캐너가 **실제 파서와 같은 곳을 주석으로 보는지** 대조한다.
 *
 * 왜 필요한가: 가드 다섯이 전부 이 스캐너를 통과한다. 여기서 주석 판정이
 * 틀리면 그 아래 모든 판정이 조용히 무의미해진다 — 실제로 그런 일이 있었다.
 * 정규식 리터럴 안의 따옴표 하나가 가짜 문자열을 열어 파일 뒷부분의 주석
 * 제거가 통째로 꺼졌고, 감사가 babel과 대조하기 전까지 아무도 몰랐다
 * (제품 파일 8개, 주석 139개). 반대 방향도 있었다 — heading 본문의 `//`를
 * 주석으로 보고 닫는 태그를 지워 다음 heading을 삼켰다.
 *
 * 그래서 스캐너를 **자기 규칙으로 검사하지 않는다.** 독립적으로 구현된 파서를
 * 정답지로 두고 좌표를 비교한다. 스캐너와 그 테스트가 같은 가정을 공유하면
 * 함께 틀리기 때문이다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

interface Span {
    start: number;
    end: number;
}

function babelCommentSpans(source: string, file: string): Span[] {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: [
            'typescript',
            file.endsWith('.tsx') ? 'jsx' : 'typescript',
            'decorators-legacy',
        ],
    });
    return (ast.comments ?? [])
        .filter(c => c.start != null && c.end != null)
        .map(c => ({ start: c.start as number, end: c.end as number }));
}

/** 스캐너가 공백으로 바꾼 구간(줄바꿈 제외). */
function blankedIndices(original: string, blanked: string): Set<number> {
    const out = new Set<number>();
    for (let i = 0; i < original.length; i += 1) {
        if (original[i] !== blanked[i]) out.add(i);
    }
    return out;
}

describe('source scanner parity', () => {
    it('babel이 주석이라고 본 구간을 빠짐없이 비운다', () => {
        const missed: string[] = [];
        for (const file of sourceFiles(SRC_DIR)) {
            const source = readFileSync(file, 'utf8');
            let spans: Span[];
            try {
                spans = babelCommentSpans(source, file);
            } catch {
                continue; // 파싱 불가 파일은 이 테스트의 대상이 아니다
            }
            const blanked = blankedIndices(source, blankComments(source));
            for (const span of spans) {
                for (let i = span.start; i < span.end; i += 1) {
                    if (source[i] === '\n' || /\s/.test(source[i])) continue;
                    if (!blanked.has(i)) {
                        missed.push(
                            `${path.relative(SRC_DIR, file)}:${source.slice(0, span.start).split('\n').length}`
                        );
                        break;
                    }
                }
            }
        }
        expect([...new Set(missed)].sort()).toEqual([]);
    });

    it('주석이 아닌 코드는 비우지 않는다', () => {
        const overreach: string[] = [];
        for (const file of sourceFiles(SRC_DIR)) {
            const source = readFileSync(file, 'utf8');
            let spans: Span[];
            try {
                spans = babelCommentSpans(source, file);
            } catch {
                continue;
            }
            const inComment = new Set<number>();
            for (const span of spans) {
                for (let i = span.start; i < span.end; i += 1) inComment.add(i);
            }
            for (const i of blankedIndices(source, blankComments(source))) {
                if (!inComment.has(i)) {
                    overreach.push(
                        `${path.relative(SRC_DIR, file)}:${source.slice(0, i).split('\n').length}`
                    );
                    break;
                }
            }
        }
        expect([...new Set(overreach)].sort()).toEqual([]);
    });

    it('길이와 줄 수를 보존한다', () => {
        const sample = "const a = 1; // 메모\n/* 블록 */\nconst b = '//';\n";
        const blanked = blankComments(sample);
        expect(blanked).toHaveLength(sample.length);
        expect(blanked.split('\n')).toHaveLength(sample.split('\n').length);
        expect(blanked).toContain("const b = '//';");
    });
});
