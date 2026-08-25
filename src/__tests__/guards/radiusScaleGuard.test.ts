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

/**
 * 스케일: `rounded-full`·`rounded-sm`·`rounded-lg`·`rounded-none`, 그리고 접미사
 * 없는 `rounded`. 나머지는 전부 검출 대상이다.
 *
 * 처음엔 `md|xl|2xl|3xl`을 열거했는데, 그건 형제 가드에서 방금 걷어낸 바로 그
 * 형태였다 — 감사가 `rounded-4xl`(v4 실존 유틸)과 `rounded-[14px]`(임의값)로
 * 통과시켰다. 허용식이면 새 유틸이 생겨도 자동으로 걸린다.
 */
// 접미사는 낱말, 대괄호 임의값, 또는 v4의 CSS 변수 축약형 `(--var)`다.
// 점·괄호를 무제한으로 받으면 테스트 안의 CSS 선택자(`rounded-full.h-1.flex-1`)를
// 통째로 삼켜 오탐이 나므로 세 형태만 좁게 받는다. 대괄호만 넣었을 때는
// `rounded-(--card-radius)`가 **매치 0건**이라 조용히 허용됐다 — 한 문법
// 가족을 반만 모델링하면 나머지 반이 구멍이 된다.
const RADIUS_RE =
    /\brounded(?:-[trblse]{1,2})?(?:-(\[[^\]\s]*\]|\(--[^)\s]*\)|[\w-]+))?(?![\w-])/g;
const ALLOWED_RADIUS = new Set(['full', 'sm', 'lg', 'none']);

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
        .replace(
            /(^|[\s,(){}])\/\/[^\n]*/g,
            (m, p1) => p1 + blank(m.slice(p1.length))
        );
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
            for (const m of line.matchAll(RADIUS_RE)) {
                const suffix = m[1];
                if (suffix === undefined || ALLOWED_RADIUS.has(suffix))
                    continue;
                out.push(`${rel}:${i + 1} ${m[0]}`);
            }
        });
    }
    return out.sort();
}

describe('radius scale guard', () => {
    it('스케일 밖 반경을 쓰지 않는다', () => {
        expect(offScaleRadii()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const offScale = (cls: string): boolean =>
            [...cls.matchAll(RADIUS_RE)].some(
                m => m[1] !== undefined && !ALLOWED_RADIUS.has(m[1])
            );
        expect(offScale('rounded-xl border')).toBe(true);
        expect(offScale('rounded-t-2xl')).toBe(true);
        // 열거식이 놓쳤던 둘 — v4 실존 유틸과 임의값.
        expect(offScale('rounded-4xl')).toBe(true);
        expect(offScale('rounded-[14px]')).toBe(true);
        expect(offScale('rounded-(--card-radius)')).toBe(true);
        expect(offScale('rounded-lg')).toBe(false);
        expect(offScale('rounded-full')).toBe(false);
        expect(offScale('rounded')).toBe(false);
    });
});
