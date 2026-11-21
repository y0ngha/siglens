import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../..');
const SOURCE = readFileSync(path.join(ROOT, 'db/scripts/migrate.ts'), 'utf8');
const JOURNAL = JSON.parse(
    readFileSync(path.join(ROOT, 'drizzle/meta/_journal.json'), 'utf8')
) as { entries: Array<{ idx: number; tag: string }> };

/**
 * expand/contract 마이그레이션은 **사이에 코드 배포가 끼어야** 한다.
 *
 * 예전에는 0030을 저널에서 빼서 막았는데, 그러면 `drizzle-kit`의 스냅샷
 * 체인이 끊겨 `db:generate`가 매번 같은 DDL을 다시 뱉는다(실제로 그 상태였고,
 * `0029_snapshot.json`이 없었다). 저널에 두고 `--until`로 멈추는 쪽이 옳다.
 */
describe('db:migrate --until', () => {
    it('저널이 0029 → 0030 순서로 이어진다', () => {
        const tags = JOURNAL.entries.map(e => e.tag);
        const expand = tags.indexOf('0029_content_locale');
        const contract = tags.indexOf('0030_drop_seo_snapshot_legacy_uq');
        expect(expand, '0029가 저널에 있어야 한다').toBeGreaterThanOrEqual(0);
        expect(contract, '0030도 저널에 있어야 한다').toBe(expand + 1);
    });

    it('idx가 배열 순서와 일치한다', () => {
        JOURNAL.entries.forEach((entry, i) => {
            expect(entry.idx, `entries[${i}]`).toBe(i);
        });
    });

    it.each(['0029_content_locale', '0030_drop_seo_snapshot_legacy_uq'])(
        '%s: 스냅샷 파일이 있다',
        tag => {
            const idx = tag.slice(0, 4);
            expect(() =>
                readFileSync(
                    path.join(ROOT, `drizzle/meta/${idx}_snapshot.json`),
                    'utf8'
                )
            ).not.toThrow();
        }
    );

    /**
     * **이미 적용된 마이그레이션을 건너뛸 때도 멈춰야 한다.** `continue`만
     * 있으면 두 번째 실행에서 `--until` 경계를 조용히 넘어 0030까지 적용된다
     * — 그 순간 스위치가 꺼진 인스턴스의 프리웜이 42P10으로 죽는다.
     */
    it('skip 경로에도 멈춤 판정이 있다', () => {
        const skipBlock = SOURCE.slice(
            SOURCE.indexOf('skip (already applied)')
        ).slice(0, 400);
        expect(skipBlock).toContain('entry.tag === until');
        // 멈춤 판정이 `continue`보다 먼저 와야 의미가 있다.
        expect(skipBlock.indexOf('entry.tag === until')).toBeLessThan(
            skipBlock.indexOf('continue;')
        );
    });

    /**
     * 문장을 하나씩 실행하고 트랜잭션이 없어서, 중간 문장이 실패하면 앞 문장은 이미 적용된 채 남는다. 재실행이
     * 안전하려면 "이미 있음" 오류가 문장 단위로 건너뛰어져야 하고, `ADD COLUMN`의 중복 컬럼(42701)도 거기 든다.
     */
    describe('이미 있음 오류는 문장 단위로 건너뛴다', () => {
        const codes = [
            ...(
                /ALREADY_EXISTS_CODES = new Set\(\[([^\]]*)\]\)/.exec(
                    SOURCE
                )?.[1] ?? ''
            ).matchAll(/'([0-9A-Z]{5})'/g),
        ].map(match => match[1]);

        it.each([
            ['42P07', '테이블·인덱스'],
            ['42710', '타입·제약'],
            ['42P16', '기본 키'],
            ['42701', '컬럼 추가(ADD COLUMN) 중복'],
        ])('%s(%s)를 건너뛴다', code => {
            expect(codes).toContain(code);
        });

        it('그 밖의 코드는 건너뛰지 않고 던진다', () => {
            const catchBlock = SOURCE.slice(
                SOURCE.indexOf('await sql.unsafe(statement)')
            ).slice(0, 700);
            expect(catchBlock).toContain('ALREADY_EXISTS_CODES.has(code)');
            expect(catchBlock).toContain('throw err');
            expect(codes).toHaveLength(4);
        });
    });

    it('저널에 없는 태그를 주면 던진다', () => {
        expect(SOURCE).toContain('저널에 없는 태그다');
    });
});
