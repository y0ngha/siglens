import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 반경 스케일 단일화 가드.
 *
 * 리디자인의 가로지르는 불변식 넷 중 셋(컨트롤 보더 토큰·heading 색·테마 패리티)은
 * 각자 가드를 얻었는데, **가장 많은 파일을 건드린** 반경 통일만 없었다. `rounded-xl`
 * ·`rounded-2xl`·`rounded-md`를 전부 걷어내 `rounded-lg`(+`rounded-full`, `rounded-sm`)
 * 로 모았지만, 되돌리는 편집을 막는 건 아무것도 없었다 — 네 군데만 테스트가 핀으로
 * 잡고 있었다. 감사가 "같은 모양의 15줄짜리 가드면 전부 잡힌다"고 지적한 자리다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** 스케일 밖 반경. `rounded-full`·`rounded-sm`·`rounded-lg`·`rounded-none`만 쓴다. */
const OFF_SCALE_RE = /\brounded(-[trblse]{1,2})?-(md|xl|2xl|3xl)\b/;

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
        else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
    }
    return out;
}

/**
 * 주석을 같은 길이의 공백으로 바꾼다 — 지우면 줄번호가 밀린다.
 * 근거 주석에 `rounded-xl` 같은 토큰 이름이 적히는 건 정상이고(실제로
 * `surfaceStyles.ts`의 설명이 그렇다), 그건 코드가 아니다.
 */
function blankComments(source: string): string {
    const blank = (m: string) => m.replace(/[^\n]/g, ' ');
    return source
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(?<=^|\n)[ \t]*\/\/[^\n]*/g, blank);
}

function offScaleRadii(): string[] {
    const out: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
        const rel = path.relative(SRC_DIR, file);
        // 이 가드 자신은 위 정규식과 아래 설명 문구에 토큰 이름을 담고 있다.
        if (
            rel === path.join('__tests__', 'guards', 'radiusScaleGuard.test.ts')
        )
            continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        source.split('\n').forEach((line, i) => {
            const m = OFF_SCALE_RE.exec(line);
            if (m !== null) out.push(`${rel}:${i + 1} ${m[0]}`);
        });
    }
    return out.sort();
}

describe('radius scale guard', () => {
    it('스케일 밖 반경을 쓰지 않는다', () => {
        expect(offScaleRadii()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        expect(OFF_SCALE_RE.test('rounded-xl border')).toBe(true);
        expect(OFF_SCALE_RE.test('rounded-t-2xl')).toBe(true);
        expect(OFF_SCALE_RE.test('rounded-lg')).toBe(false);
        expect(OFF_SCALE_RE.test('rounded-full')).toBe(false);
    });
});
