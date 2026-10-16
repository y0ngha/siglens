import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { DartQuotaError, dartFatalReason } from '@/shared/api/dart/dartClient';
import { createFakeDartClient } from '@/shared/api/dart/fakeDartClient';
import { INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS } from '../../lib/investorFlowsPolicy';
import {
    runDartCorpCodeIngest,
    type IngestDartCorpCodeDeps,
} from '../../server/ingestDartCorpCode';
import type { DartCorpCodeRow } from '../../model';

/** 상장사 `count`곳 — 종목코드 `100000`부터, 고유번호 `00100000`부터. */
const listedCorps = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
        corpCode: String(100_000 + index).padStart(8, '0'),
        corpName: `회사${index}`,
        stockCode: String(100_000 + index * 10),
    }));

function build(
    over: Partial<IngestDartCorpCodeDeps> = {},
    corps = listedCorps(INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS)
) {
    const stored: DartCorpCodeRow[] = [];
    const dart = createFakeDartClient({
        corpCodes: [
            ...corps,
            { corpCode: '00434003', corpName: '다코', stockCode: ' ' },
        ],
        disclosures: {},
        majorStock: {},
        executiveStock: {},
    });
    const log = vi.fn();
    const deps: IngestDartCorpCodeDeps = {
        dart,
        repo: {
            upsertCorpCodes: async rows => {
                stored.push(...rows);
            },
        },
        fatalReason: dartFatalReason,
        log,
        ...over,
    };
    return { deps, dart, stored, log };
}

describe('runDartCorpCodeIngest', () => {
    it('without a key: no request and no write', async () => {
        const { deps, dart, stored } = build({
            dart: {
                isEnabled: () => false,
                fetchCorpCodeZip: vi.fn(),
            },
        });
        expect(await runDartCorpCodeIngest(deps)).toEqual({
            status: 'disabled',
            rows: 0,
            skipped: 0,
        });
        expect(deps.dart.fetchCorpCodeZip).not.toHaveBeenCalled();
        expect(dart.calls).toEqual([]);
        expect(stored).toEqual([]);
    });

    it('upserts every listed company from one corpCode.xml request', async () => {
        const { deps, dart, stored } = build();
        const result = await runDartCorpCodeIngest(deps);
        expect(result).toEqual({
            status: 'complete',
            rows: INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS,
            skipped: 0,
        });
        expect(dart.calls).toEqual(['corpCode.xml']);
        expect(stored).toHaveLength(INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS);
        expect(stored).toContainEqual({
            stockCode: '100000',
            corpCode: '00100000',
            corpName: '회사0',
        });
    });

    it('rejects a file with fewer listed rows than the minimum and leaves the map alone', async () => {
        const { deps, stored, log } = build(
            {},
            listedCorps(INVESTOR_FLOWS_DART_CORP_CODE_MIN_ROWS - 1)
        );
        expect((await runDartCorpCodeIngest(deps)).status).toBe('rejected');
        expect(stored).toEqual([]);
        expect(
            log.mock.calls.some(([message]) =>
                String(message).startsWith('[dart-corp-code] rejected')
            )
        ).toBe(true);
    });

    it('reports a DART refusal (quota) instead of failing the run', async () => {
        const { deps, stored } = build({
            dart: {
                isEnabled: () => true,
                fetchCorpCodeZip: async () => {
                    throw new DartQuotaError('corpCode.xml', 'quota');
                },
            },
        });
        expect(await runDartCorpCodeIngest(deps)).toEqual({
            status: 'dart_refused',
            refusedBy: 'quota_exhausted',
            rows: 0,
            skipped: 0,
        });
        expect(stored).toEqual([]);
    });

    it('rethrows a non-fatal failure so the cron logs "run failed"', async () => {
        const { deps } = build({
            dart: {
                isEnabled: () => true,
                fetchCorpCodeZip: async () => {
                    throw new Error('socket hang up');
                },
            },
        });
        await expect(runDartCorpCodeIngest(deps)).rejects.toThrow(
            'socket hang up'
        );
    });

    it('rejects a zip with more than one file', async () => {
        const { deps, stored } = build({
            dart: {
                isEnabled: () => true,
                fetchCorpCodeZip: async () =>
                    zipSync({
                        'a.xml': strToU8('<result/>'),
                        'b.xml': strToU8('<result/>'),
                    }),
            },
        });
        await expect(runDartCorpCodeIngest(deps)).rejects.toThrow(
            'expected exactly one file'
        );
        expect(stored).toEqual([]);
    });
});
