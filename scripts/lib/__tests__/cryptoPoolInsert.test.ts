import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    extractCandidatePool,
    insertIntoCandidatePool,
} from '../cryptoPoolInsert';

/** 손으로 만든 픽스처가 아니라 실제 스크립트 원문에 적용한다. */
const REAL = readFileSync(
    resolve(process.cwd(), 'scripts/update-popular-cryptos.ts'),
    'utf-8'
);

// 풀에 들어갈 일 없는 형상 — 실제 코인을 쓰면 스크립트가 넣은 뒤 "이미 있음"으로 건너뛴다.
const NEW_A = 'ZZZVISITAUSD';
const NEW_B = 'ZZZVISITBUSD';

describe('extractCandidatePool', () => {
    it('실제 스크립트의 CRYPTO_CANDIDATE_POOL 심볼을 읽는다', () => {
        const pool = extractCandidatePool(REAL);
        expect(pool).toContain('BTCUSD');
        expect(pool).toContain('PEPEUSD');
        // 풀 밖의 문자열(STABLECOINS 등)은 세지 않는다.
        expect(pool).not.toContain('USDT');
    });
});

describe('insertIntoCandidatePool', () => {
    it('풀 배열 끝에 방문 후보를 날짜 주석과 함께 덧붙인다', () => {
        const out = insertIntoCandidatePool(REAL, [NEW_A], '2026-09-24');
        const pool = extractCandidatePool(out);

        expect(pool.at(-1)).toBe(NEW_A);
        expect(pool.slice(0, -1)).toEqual(extractCandidatePool(REAL));
        expect(out).toContain(`    '${NEW_A}', // 방문 후보 (2026-09-24)`);
    });

    it('여러 개를 순서대로 넣고, 풀 밖 코드는 건드리지 않는다', () => {
        const out = insertIntoCandidatePool(REAL, [NEW_A, NEW_B], '2026-09-24');
        const declEnd = REAL.indexOf(
            '\n];\n',
            REAL.indexOf('export const CRYPTO_CANDIDATE_POOL')
        );

        expect(extractCandidatePool(out).slice(-2)).toEqual([NEW_A, NEW_B]);
        expect(out.slice(out.length - (REAL.length - declEnd))).toBe(
            REAL.slice(declEnd)
        );
    });

    it('이미 풀에 있는 심볼·입력 내 중복은 건너뛴다 (멱등)', () => {
        expect(insertIntoCandidatePool(REAL, ['BTCUSD'], '2026-09-24')).toBe(
            REAL
        );
        const once = insertIntoCandidatePool(
            REAL,
            [NEW_A, NEW_A],
            '2026-09-24'
        );
        expect(
            extractCandidatePool(once).filter(s => s === NEW_A)
        ).toHaveLength(1);
        expect(insertIntoCandidatePool(once, [NEW_A], '2026-09-25')).toBe(once);
    });

    it('빈 입력이면 원문 그대로', () => {
        expect(insertIntoCandidatePool(REAL, [], '2026-09-24')).toBe(REAL);
    });

    it('앵커가 없으면 던진다', () => {
        expect(() =>
            insertIntoCandidatePool('const x = 1;', [NEW_A], '2026-09-24')
        ).toThrow(/CRYPTO_CANDIDATE_POOL declaration/);
    });

    it('풀 배열의 끝 앵커가 없으면 던진다', () => {
        const unterminated =
            "export const CRYPTO_CANDIDATE_POOL: readonly string[] = [\n    'BTCUSD',\n";
        expect(() =>
            insertIntoCandidatePool(unterminated, [NEW_A], '2026-09-24')
        ).toThrow(/CRYPTO_CANDIDATE_POOL end/);
    });
});
