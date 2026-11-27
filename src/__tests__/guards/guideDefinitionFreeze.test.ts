import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **정의형 가이드 동결 가드.**
 *
 * 가이드의 "정의형" 분류(캔들·차트 패턴·보조지표·전략, 90개)는 더 늘리지 않는다. 새 스킬이 생기면
 * `guideCoverage.test.ts`가 가이드 항목이나 `GUIDE_PENDING_SKILLS` 등록을 요구하는데, 그 규칙이 새 정의
 * 가이드를 쓰는 쪽으로 밀기 때문이다. 정의형 글은 사전처럼 검색 수요가 얇고 서로 겹쳐, 늘릴수록 색인 평가를
 * 깎는다(2026-09 SEO 재감사). 새 스킬은 `GUIDE_PENDING_SKILLS`에 올려 두고, 늘리고 싶은 글은 `howto`
 * (상황별 실전 가이드, 상한 없음)로 쓴다.
 *
 * 동결 값은 **줄일 수만 있다**. 항목을 지우면 이 표의 숫자도 같이 내리고, 올리려면 이 정책을 바꾸는
 * 결정이 먼저다.
 */
const SEEDS_DIR = path.resolve(__dirname, '../../../db/seeds/guide');

const FROZEN_DEFINITION_COUNTS = {
    candlesticks: 20,
    'chart-patterns': 22,
    indicators: 37,
    strategies: 11,
} as const satisfies Record<string, number>;

type FrozenCategory = keyof typeof FROZEN_DEFINITION_COUNTS;

/** 분류 디렉터리 안의 항목 슬러그 수(항목 하나 = 하위 디렉터리 하나). */
function countSlugs(seedsDir: string, category: string): number {
    return readdirSync(path.join(seedsDir, category), {
        withFileTypes: true,
    }).filter(entry => entry.isDirectory()).length;
}

/** 동결 값을 넘은 분류와 그 수. 정책을 이름으로 알려 주는 메시지를 만든다. */
function overFrozen(seedsDir: string): string[] {
    return (Object.keys(FROZEN_DEFINITION_COUNTS) as FrozenCategory[]).flatMap(
        category => {
            const count = countSlugs(seedsDir, category);
            const frozen = FROZEN_DEFINITION_COUNTS[category];
            return count > frozen
                ? [
                      `${category}: ${count}개 (동결 ${frozen}개) — 정의형 가이드는 더 늘리지 않는다. 새 스킬은 GUIDE_PENDING_SKILLS에 올리고, 글은 howto로 쓴다.`,
                  ]
                : [];
        }
    );
}

/** 동결 값이 실제 수보다 큰 분류 — 분류·동결 값·실제 수를 메시지에 담는다. */
function slackFrozen(seedsDir: string): string[] {
    return (Object.keys(FROZEN_DEFINITION_COUNTS) as FrozenCategory[]).flatMap(
        category => {
            const count = countSlugs(seedsDir, category);
            const frozen = FROZEN_DEFINITION_COUNTS[category];
            return count < frozen
                ? [
                      `${category}: 동결 ${frozen}개 > 실제 ${count}개 — 항목을 지웠으니 FROZEN_DEFINITION_COUNTS.${category}를 ${count}로 내린다.`,
                  ]
                : [];
        }
    );
}

describe('정의형 가이드 동결', () => {
    it('분류별 항목 수가 동결 값을 넘지 않는다', () => {
        expect(overFrozen(SEEDS_DIR)).toEqual([]);
    });

    it('동결 값이 실제 수보다 크게 남아 있지 않다 — 항목을 지웠다면 표도 내린다', () => {
        expect(slackFrozen(SEEDS_DIR)).toEqual([]);
    });

    it('항목이 하나 늘면 분류 이름과 정책을 담아 실패한다', () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'guide-freeze-'));
        try {
            (Object.keys(FROZEN_DEFINITION_COUNTS) as FrozenCategory[]).forEach(
                category => {
                    Array.from(
                        { length: FROZEN_DEFINITION_COUNTS[category] },
                        (_, i) => i
                    ).forEach(i =>
                        mkdirSync(path.join(dir, category, `slug-${i}`), {
                            recursive: true,
                        })
                    );
                }
            );
            expect(overFrozen(dir)).toEqual([]);

            mkdirSync(path.join(dir, 'indicators', 'brand-new'));

            const [message, ...rest] = overFrozen(dir);
            expect(rest).toEqual([]);
            expect(message).toContain('indicators: 38개 (동결 37개)');
            expect(message).toContain('GUIDE_PENDING_SKILLS');

            // 반대 방향: 항목을 하나 지우면(동결 > 실제) 분류·동결 값·실제 수를 담아 실패한다.
            rmSync(path.join(dir, 'indicators', 'brand-new'), {
                recursive: true,
            });
            rmSync(path.join(dir, 'indicators', 'slug-0'), { recursive: true });

            expect(slackFrozen(dir)).toEqual([
                expect.stringContaining('indicators: 동결 37개 > 실제 36개'),
            ]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
