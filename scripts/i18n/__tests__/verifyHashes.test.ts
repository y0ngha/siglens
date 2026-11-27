import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const SPAWN_TEST_TIMEOUT_MS = 30_000;

const trees: string[] = [];

/** verify.mjs는 ROOT를 스크립트 경로에서 구하므로, 사본 트리가 곧 ROOT가 된다. */
function makeTree(hashes: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'verify-hash-'));
    trees.push(root);
    cpSync(join(REPO_ROOT, 'scripts/i18n'), join(root, 'scripts/i18n'), {
        recursive: true,
        filter: source => !source.includes('__tests__'),
    });
    mkdirSync(join(root, 'src/shared/i18n'), { recursive: true });
    cpSync(
        join(REPO_ROOT, 'src/shared/i18n/locales.ts'),
        join(root, 'src/shared/i18n/locales.ts')
    );
    mkdirSync(join(root, 'messages/_meta'), { recursive: true });
    const catalogs = {
        ko: { a: '안녕하세요 반갑습니다', b: '감사합니다 정말로' },
        en: { a: 'Hello, nice to meet you', b: 'Thank you very much' },
        ja: { a: 'こんにちは、はじめまして', b: 'どうもありがとう' },
        zh: { a: '你好,很高兴见到你', b: '非常感谢你' },
    };
    for (const [locale, body] of Object.entries(catalogs)) {
        writeFileSync(
            join(root, `messages/${locale}.json`),
            JSON.stringify(body)
        );
    }
    writeFileSync(
        join(root, 'messages/_meta/hashes.json'),
        JSON.stringify(hashes)
    );
    return root;
}

function verify(root: string) {
    return spawnSync(
        process.execPath,
        [join(root, 'scripts/i18n/verify.mjs')],
        { encoding: 'utf8' }
    );
}

async function hashOfKo(text: string): Promise<string> {
    const mod = (await import(
        join(REPO_ROOT, 'scripts/i18n/lib/hashOf.mjs')
    )) as { hashOf: (t: string) => string };
    return mod.hashOf(text);
}

describe('verify.mjs 게이트 9 (hashes.json 최신성)', () => {
    afterAll(() => {
        trees.forEach(root => rmSync(root, { recursive: true, force: true }));
    });

    it(
        '해시가 ko 값과 일치하면 통과한다',
        { timeout: SPAWN_TEST_TIMEOUT_MS },
        async () => {
            const root = makeTree({
                a: await hashOfKo('안녕하세요 반갑습니다'),
                b: await hashOfKo('감사합니다 정말로'),
                // 고아 항목은 translate.mjs가 무시하므로 통과한다.
                gone: 'deadbeef0000',
            });
            const result = verify(root);
            expect(result.stderr).toBe('');
            expect(result.status).toBe(0);
        }
    );

    it(
        '오래된 해시는 키·저장값·기대값·수정 방법과 함께 실패한다',
        { timeout: SPAWN_TEST_TIMEOUT_MS },
        async () => {
            const expected = await hashOfKo('안녕하세요 반갑습니다');
            const root = makeTree({
                a: '000000000000',
                b: await hashOfKo('감사합니다 정말로'),
            });
            const result = verify(root);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain('9-해시');
            expect(result.stderr).toContain(
                `a: 저장 000000000000 ≠ 기대 ${expected}`
            );
            expect(result.stderr).not.toContain('b: ');
            expect(result.stderr).toContain('hashOf.mjs');
        }
    );

    it(
        '항목이 없는 키도 실패한다',
        { timeout: SPAWN_TEST_TIMEOUT_MS },
        async () => {
            const root = makeTree({
                a: await hashOfKo('안녕하세요 반갑습니다'),
            });
            const result = verify(root);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain('b: 항목 없음');
        }
    );

    it('현재 트리의 ko 카탈로그와 hashes.json은 어긋남이 없다', () => {
        const result = spawnSync(
            process.execPath,
            [join(REPO_ROOT, 'scripts/i18n/verify.mjs')],
            { encoding: 'utf8' }
        );
        expect(result.stderr).not.toContain('9-해시');
        expect(result.status).toBe(0);
    });
});
