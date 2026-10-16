import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildFakeDartData, createFakeDartClient } from '../fakeDartClient';

describe('createFakeDartClient', () => {
    it('is enabled without a key and records every call', async () => {
        const client = createFakeDartClient();
        expect(client.isEnabled()).toBe(true);
        await client.fetchMajorStock('00126380');
        await client.fetchExecutiveStock('00160843');
        expect(client.calls).toEqual(['majorstock.json', 'elestock.json']);
    });

    it('serves corpCode.xml as a single-entry zip in the DART list format', async () => {
        const zip = await createFakeDartClient().fetchCorpCodeZip();
        const files = unzipSync(zip);
        expect(Object.keys(files)).toEqual(['CORPCODE.xml']);
        const xml = strFromU8(files['CORPCODE.xml'] ?? new Uint8Array());
        expect(xml).toContain(
            '<corp_code>00126380</corp_code><corp_name>삼성전자</corp_name>'
        );
        expect(xml).toContain('<stock_code> </stock_code>');
    });

    it('filters disclosures by the requested receipt-date window', async () => {
        const now = new Date('2026-10-16T01:00:00Z'); // 2026-10-16 KST
        const client = createFakeDartClient(undefined, { now: () => now });
        const inside = await client.fetchDisclosureList({
            beginDate: '2026-10-14',
            endDate: '2026-10-16',
            detailType: 'D005',
            pageNo: 1,
        });
        const outside = await client.fetchDisclosureList({
            beginDate: '2026-10-15',
            endDate: '2026-10-16',
            detailType: 'D005',
            pageNo: 1,
        });
        expect(inside.rows).toEqual(buildFakeDartData(now).disclosures.D005);
        expect(inside.totalPage).toBe(1);
        expect(outside).toMatchObject({ rows: [], totalPage: 0 });
    });

    it.each([
        ['2026-10-16T01:00:00Z', '2026-10-15', '2026-10-14'],
        ['2031-03-02T16:00:00Z', '2031-03-02', '2031-03-01'], // 01:00 KST on the 3rd
    ])(
        'returns rows dated relative to now=%s (KST yesterday %s, plans %s)',
        async (iso, yesterday, twoDaysAgo) => {
            const now = new Date(iso);
            const client = createFakeDartClient(undefined, { now: () => now });
            const window = {
                beginDate: twoDaysAgo,
                endDate: yesterday,
                pageNo: 1,
            } as const;
            const [major, insider, plans] = await Promise.all(
                (['D001', 'D002', 'D005'] as const).map(detailType =>
                    client.fetchDisclosureList({ ...window, detailType })
                )
            );
            expect(major?.rows.map(row => row.rcept_dt)).toEqual([
                yesterday.replaceAll('-', ''),
            ]);
            expect(insider?.rows).toHaveLength(1);
            expect(plans?.rows.map(row => row.rcept_dt)).toEqual([
                twoDaysAgo.replaceAll('-', ''),
            ]);
            const [executive] = await client.fetchExecutiveStock('00160843');
            expect(executive?.rcept_dt).toBe(yesterday);
        }
    );

    it('reads the clock at call time, not at creation', async () => {
        let now = new Date('2026-10-16T01:00:00Z');
        const client = createFakeDartClient(undefined, { now: () => now });
        now = new Date('2030-01-10T01:00:00Z');
        const [row] = await client.fetchMajorStock('00126380');
        expect(row?.rcept_dt).toBe('20300109');
    });

    it('pages disclosures 100 at a time', async () => {
        const rows = Array.from({ length: 150 }, (_, index) => ({
            rcept_no: String(20261015000000 + index),
            rcept_dt: '20261015',
        }));
        const client = createFakeDartClient({
            corpCodes: [],
            disclosures: { D001: rows },
            majorStock: {},
            executiveStock: {},
        });
        const page2 = await client.fetchDisclosureList({
            beginDate: '2026-10-15',
            endDate: '2026-10-15',
            detailType: 'D001',
            pageNo: 2,
        });
        expect(page2).toMatchObject({
            pageNo: 2,
            totalPage: 2,
            totalCount: 150,
        });
        expect(page2.rows).toHaveLength(50);
    });

    it('returns an empty history for an unknown corp', async () => {
        expect(
            await createFakeDartClient().fetchMajorStock('00000000')
        ).toEqual([]);
    });
});
