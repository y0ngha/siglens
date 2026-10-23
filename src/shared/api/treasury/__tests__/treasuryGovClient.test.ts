import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';
import {
    fetchTreasuryGovSnapshot,
    parseTreasuryGovCsv,
    TREASURY_GOV_MAX_BODY_BYTES,
    TREASURY_GOV_RENDER_TIMEOUT_MS,
    TREASURY_GOV_REQUEST_TIMEOUT_MS,
    TreasuryGovHttpError,
    treasuryGovCsvUrl,
} from '../treasuryGovClient';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: async () => undefined }));

/** Deny-by-default fetch: any request not stubbed by the test fails it. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

// 2026-10-23 실측 CSV의 앞 세 줄(열 이름·순서 그대로)
const HEADER =
    'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"';
const CSV_2026 = [
    HEADER,
    '10/22/2026,4.11,4.10,4.16,4.22,4.29,4.29,4.41,4.65,4.72,4.78,4.86,4.96,5.32,5.29',
    '10/21/2026,4.09,4.12,4.16,4.25,4.34,4.35,4.52,4.81,4.89,4.95,5.03,5.13,5.47,5.42',
].join('\n');

describe('parseTreasuryGovCsv', () => {
    it('가장 최근 날짜 행의 2년·10년물을 ISO 날짜로 낸다', () => {
        expect(parseTreasuryGovCsv(CSV_2026)).toEqual({
            date: '2026-10-22',
            year2: 4.65,
            year10: 4.96,
        });
    });

    it('행 순서가 아니라 날짜로 최근 행을 고른다', () => {
        const [h, a, b] = CSV_2026.split('\n');
        expect(parseTreasuryGovCsv([h, b, a].join('\r\n'))?.date).toBe(
            '2026-10-22'
        );
    });

    it('10년물이 빈 행은 건너뛰고, 열 위치가 아니라 이름으로 찾는다', () => {
        const csv = [
            'Date,"10 Yr","2 Yr"',
            '10/23/2026,,4.70',
            '10/22/2026,4.96,4.65',
        ].join('\n');
        expect(parseTreasuryGovCsv(csv)).toEqual({
            date: '2026-10-22',
            year2: 4.65,
            year10: 4.96,
        });
    });

    it('날짜 형식이 다른 행은 건너뛴다', () => {
        const csv = [
            HEADER,
            '2026-10-23,4.1,4.1,4.1,4.2,4.2,4.2,4.4,4.7,4.7,4.8,4.9,4.99,5.3,5.3',
            '10/22/2026,4.11,4.10,4.16,4.22,4.29,4.29,4.41,4.65,4.72,4.78,4.86,4.96,5.32,5.29',
        ].join('\n');
        expect(parseTreasuryGovCsv(csv)?.date).toBe('2026-10-22');
    });

    it('헤더만 있거나 10년물 열이 없으면 null', () => {
        expect(parseTreasuryGovCsv(HEADER)).toBeNull();
        expect(parseTreasuryGovCsv('Date,"2 Yr"\n10/22/2026,4.65')).toBeNull();
        expect(parseTreasuryGovCsv('')).toBeNull();
    });
});

describe('fetchTreasuryGovSnapshot', () => {
    beforeEach(() => {
        fetchSpy.mockClear();
        vi.stubGlobal('fetch', fetchSpy);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('그 해 CSV를 캐시 없이, 시간 제한을 걸어 읽는다', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        fetchSpy.mockResolvedValueOnce(new Response(CSV_2026, { status: 200 }));
        expect((await fetchTreasuryGovSnapshot(2026))?.year10).toBe(4.96);
        expect(fetchSpy).toHaveBeenCalledWith(
            treasuryGovCsvUrl(2026),
            expect.objectContaining({
                cache: 'no-store',
                signal: expect.any(AbortSignal),
            })
        );
        expect(timeout).toHaveBeenCalledWith(TREASURY_GOV_REQUEST_TIMEOUT_MS);
        timeout.mockRestore();
    });

    it('페이지 렌더 중에는 짧은 시간 제한으로 한 번만 시도한다', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        fetchSpy.mockResolvedValue(new Response('down', { status: 503 }));
        await expect(
            runWithRenderBudget(() => fetchTreasuryGovSnapshot(2026))
        ).rejects.toBeInstanceOf(TreasuryGovHttpError);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(timeout).toHaveBeenCalledWith(TREASURY_GOV_RENDER_TIMEOUT_MS);
        timeout.mockRestore();
    });

    it('next build 중에도 재시도하지 않는다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        fetchSpy.mockResolvedValue(new Response('down', { status: 503 }));
        await expect(fetchTreasuryGovSnapshot(2026)).rejects.toBeInstanceOf(
            TreasuryGovHttpError
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        vi.unstubAllEnvs();
    });

    it('오프라인 빌드(SIGLENS_OFFLINE_BUILD=1)에서는 요청하지 않고 던진다', async () => {
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(fetchTreasuryGovSnapshot(2026)).rejects.toThrow(
            '[offline-build] blocked Treasury request'
        );
        expect(fetchSpy).not.toHaveBeenCalled();
        warn.mockRestore();
        vi.unstubAllEnvs();
    });

    it('본문이 상한을 넘으면 읽기를 끊고 던진다', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response('x'.repeat(TREASURY_GOV_MAX_BODY_BYTES + 1), {
                status: 200,
            })
        );
        await expect(fetchTreasuryGovSnapshot(2026)).rejects.toThrow(
            'treasury.gov body too large'
        );
    });

    it('네트워크 오류(TypeError)는 한 번 재시도한다', async () => {
        fetchSpy
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(new Response(CSV_2026, { status: 200 }));
        expect((await fetchTreasuryGovSnapshot(2026))?.date).toBe('2026-10-22');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('연초 첫 공표 전(올해 CSV에 행 없음)이면 전년도 CSV를 본다', async () => {
        fetchSpy
            .mockResolvedValueOnce(new Response(HEADER, { status: 200 }))
            .mockResolvedValueOnce(
                new Response(
                    `${HEADER}\n12/31/2026,4.0,4.0,4.0,4.0,4.0,4.0,4.0,4.2,4.3,4.4,4.5,4.6,4.9,4.8`,
                    { status: 200 }
                )
            );
        expect((await fetchTreasuryGovSnapshot(2027))?.date).toBe('2026-12-31');
        expect(
            fetchSpy.mock.calls.some(([url]) => url === treasuryGovCsvUrl(2026))
        ).toBe(true);
    });

    it('4xx는 재시도 없이 던진다', async () => {
        fetchSpy.mockResolvedValue(new Response('no', { status: 403 }));
        await expect(fetchTreasuryGovSnapshot(2026)).rejects.toBeInstanceOf(
            TreasuryGovHttpError
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('5xx는 한 번 재시도한다', async () => {
        fetchSpy
            .mockResolvedValueOnce(new Response('down', { status: 503 }))
            .mockResolvedValueOnce(new Response(CSV_2026, { status: 200 }));
        expect((await fetchTreasuryGovSnapshot(2026))?.date).toBe('2026-10-22');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
