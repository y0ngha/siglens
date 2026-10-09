import path from 'path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { seedGuide } from '@/../db/scripts/seedGuide';
import { guideEntries, guideEntryContents } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';

function writeSeed(
    root: string,
    slug: string,
    locale: string,
    extra = ''
): void {
    const dir = path.join(root, 'indicators', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        path.join(dir, `${locale}.md`),
        `---
${locale === 'ko' ? 'category: indicators\norder: 5\nrelated: []\n' : ''}title: ${slug} ${locale}
aliases: []
summary: 요약
seoTitle: 제목
seoDescription: 설명
${extra}---

본문 ${slug}
`
    );
}

interface FakeDb {
    readonly db: SiglensDatabase;
    readonly inserted: { table: unknown; rows: Record<string, unknown>[] }[];
}

function fakeDb(
    existing: { entries?: unknown[]; contents?: unknown[] } = {}
): FakeDb {
    const inserted: FakeDb['inserted'] = [];
    const db = {
        select: () => ({
            from: (table: unknown) =>
                Promise.resolve(
                    table === guideEntries
                        ? (existing.entries ?? [])
                        : (existing.contents ?? [])
                ),
        }),
        insert: (table: unknown) => ({
            values: (rows: Record<string, unknown>[]) => {
                inserted.push({ table, rows });
                return { onConflictDoUpdate: () => Promise.resolve() };
            },
        }),
    } as unknown as SiglensDatabase;
    return { db, inserted };
}

describe('seedGuide', () => {
    function seedRoot(): string {
        const root = mkdtempSync(path.join(tmpdir(), 'seed-guide-'));
        onTestFinished(() => rmSync(root, { recursive: true, force: true }));
        writeSeed(root, 'rsi', 'ko');
        writeSeed(root, 'rsi', 'en');
        return root;
    }

    it('빈 DB에는 항목 행을 먼저, 본문 행을 나중에 넣는다', async () => {
        const { db, inserted } = fakeDb();

        const result = await seedGuide(db, seedRoot());

        expect(inserted.map(call => call.table)).toEqual([
            guideEntries,
            guideEntryContents,
        ]);
        expect(result).toMatchObject({
            entriesUpserted: 1,
            contentsUpserted: 2,
        });
    });

    it('항목 행에 skills 기본값 [slug]를 싣는다', async () => {
        const { db, inserted } = fakeDb();

        await seedGuide(db, seedRoot());

        expect(inserted[0]!.rows[0]).toMatchObject({
            slug: 'rsi',
            category: 'indicators',
            sortOrder: 5,
            skills: ['rsi'],
        });
    });

    it('이미 같은 DB에는 아무것도 쓰지 않는다', async () => {
        const root = seedRoot();
        const first = fakeDb();
        await seedGuide(first.db, root);
        const entryRow = first.inserted[0]!.rows[0]!;
        const contentRows = first.inserted[1]!.rows;

        const second = fakeDb({
            entries: [entryRow],
            contents: contentRows,
        });
        const result = await seedGuide(second.db, root);

        expect(second.inserted).toEqual([]);
        expect(result).toMatchObject({
            entriesUpserted: 0,
            contentsUpserted: 0,
        });
    });

    it('시드에 없는 DB 행은 지우지 않고 경고한다', async () => {
        const { db } = fakeDb({
            entries: [
                {
                    slug: 'legacy',
                    category: 'indicators',
                    sortOrder: 1,
                    related: [],
                    skills: [],
                },
            ],
        });

        const result = await seedGuide(db, seedRoot());

        expect(result.warnings).toContain(
            'DB에만 있는 행(삭제하지 않음): entry legacy'
        );
    });

    it('번역 누락은 경고로 보고한다', async () => {
        const { db } = fakeDb();

        const result = await seedGuide(db, seedRoot());

        expect(result.warnings).toContain('rsi: ja 번역이 없다 (ko로 폴백)');
    });
});
