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
    /** `onConflictDoUpdate`에 넘어온 `set` 인자(insert 호출 순서). */
    readonly conflictSets: Record<string, unknown>[];
}

function fakeDb(
    existing: { entries?: unknown[]; contents?: unknown[] } = {}
): FakeDb {
    const inserted: FakeDb['inserted'] = [];
    const conflictSets: Record<string, unknown>[] = [];
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
                return {
                    onConflictDoUpdate: (config: {
                        set: Record<string, unknown>;
                    }) => {
                        conflictSets.push(config.set);
                        return Promise.resolve();
                    },
                };
            },
        }),
    } as unknown as SiglensDatabase;
    return { db, inserted, conflictSets };
}

/** drizzle `sql` 템플릿의 리터럴 조각만 이어 붙여 `excluded.xxx` 참조를 확인한다. */
function sqlText(value: unknown): string {
    const chunks = (value as { queryChunks: { value?: string[] }[] })
        .queryChunks;
    return chunks.flatMap(chunk => chunk.value ?? []).join('');
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

    it('항목 행에 about·signals·demoFrom 기본값을 싣는다', async () => {
        const { db, inserted } = fakeDb();

        await seedGuide(db, seedRoot());

        expect(inserted[0]!.rows[0]).toEqual(
            expect.objectContaining({
                about: [],
                signals: [],
                demoFrom: null,
            })
        );
    });

    it('howto 항목의 about·signals·demoFrom을 행에 싣고 충돌 시 갱신한다', async () => {
        const root = seedRoot();
        const dir = path.join(root, 'howto', 'rsi-how-to-read');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            path.join(dir, 'ko.md'),
            `---
category: howto
order: 1
related: []
skills: []
about: [rsi]
signals: [rsi_oversold]
demoFrom: rsi
title: RSI 보는 법
aliases: []
summary: 요약
seoTitle: RSI 보는 법
seoDescription: 설명
---

## 시그렌즈에서 확인하는 법
`
        );
        const { db, inserted, conflictSets } = fakeDb();

        await seedGuide(db, root);

        const row = inserted[0]!.rows.find(r => r.slug === 'rsi-how-to-read');
        expect(row).toMatchObject({
            about: ['rsi'],
            signals: ['rsi_oversold'],
            demoFrom: 'rsi',
        });
        const set = conflictSets[0]!;
        expect(sqlText(set.about)).toBe('excluded.about');
        expect(sqlText(set.signals)).toBe('excluded.signals');
        expect(sqlText(set.demoFrom)).toBe('excluded.demo_from');
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
                    about: [],
                    signals: [],
                    demoFrom: null,
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
