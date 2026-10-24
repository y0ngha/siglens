const { fetchAlotMatter, isDartEnabled, getKrDartCorp, getOrSetCache } =
    vi.hoisted(() => ({
        fetchAlotMatter: vi.fn(),
        isDartEnabled: vi.fn(),
        getKrDartCorp: vi.fn(),
        getOrSetCache: vi.fn(),
    }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/dart/dartClient', () => ({
    fetchAlotMatter,
    isDartEnabled,
}));
vi.mock('@/entities/investor-flows/server/getKrDartCorp', () => ({
    getKrDartCorp,
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchKrAnnualDividend,
    KR_ANNUAL_DIVIDEND_CACHE_TTL_SECONDS,
    KR_ANNUAL_DIVIDEND_MISSING_TTL_SECONDS,
    parseAlotMatterRows,
} from '@/app/api/ai/chat/tools/krAnnualDividend';

/** 실 DART 응답(2026-10-24 프로브, 케이티앤지 2025 사업보고서)에서 필요한 행만 줄인 것. */
const KTNG_ROWS = [
    { se: '주당액면가액(원)', stock_knd: '보통주', thstrm: '5,000' },
    { se: '현금배당수익률(%)', stock_knd: '보통주', thstrm: '4.10' },
    { se: '현금배당수익률(%)', stock_knd: '우선주', thstrm: '-' },
    { se: '주당 현금배당금(원)', stock_knd: '보통주', thstrm: '6,000' },
    { se: '주당 현금배당금(원)', stock_knd: '우선주', thstrm: '-' },
];

/** 종류 구분이 없는 회사(엘지유플러스 2025) — `stock_knd`가 `-`이고 같은 `se`가 두 번 온다(두 번째는 값 없음). */
const LGU_ROWS = [
    { se: '현금배당수익률(%)', stock_knd: '-', thstrm: '4.30' },
    { se: '현금배당수익률(%)', stock_knd: '-', thstrm: '-' },
    { se: '주당 현금배당금(원)', stock_knd: '-', thstrm: '660' },
    { se: '주당 현금배당금(원)', stock_knd: '-', thstrm: '-' },
];

describe('parseAlotMatterRows', () => {
    it('보통주 행의 DPS와 보고 수익률을 읽는다(우선주 행은 무시)', () => {
        expect(parseAlotMatterRows(KTNG_ROWS, 2025)).toEqual({
            fiscalYear: 2025,
            dpsCommon: 6000,
            dartYieldPct: 4.1,
        });
    });

    it('종류 구분이 없는 회사는 `-` 행의 첫 숫자를 쓴다', () => {
        expect(parseAlotMatterRows(LGU_ROWS, 2025)).toEqual({
            fiscalYear: 2025,
            dpsCommon: 660,
            dartYieldPct: 4.3,
        });
    });

    it('보통주 행이 있으면 `-` 행보다 우선한다', () => {
        expect(
            parseAlotMatterRows(
                [
                    { se: '주당 현금배당금(원)', stock_knd: '-', thstrm: '1' },
                    {
                        se: '주당 현금배당금(원)',
                        stock_knd: '보통주',
                        thstrm: '2,500',
                    },
                ],
                2025
            )?.dpsCommon
        ).toBe(2500);
    });

    it('보통주 현금배당이 없으면(`-`) 보고서는 있으므로 값만 null이다', () => {
        expect(
            parseAlotMatterRows(
                [
                    {
                        se: '주당 현금배당금(원)',
                        stock_knd: '보통주',
                        thstrm: '-',
                    },
                ],
                2025
            )
        ).toEqual({ fiscalYear: 2025, dpsCommon: null, dartYieldPct: null });
    });

    it('행이 없으면 null이다', () => {
        expect(parseAlotMatterRows([], 2025)).toBeNull();
    });
});

describe('fetchKrAnnualDividend', () => {
    const NOW = new Date('2026-10-24T03:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        isDartEnabled.mockReturnValue(true);
        getKrDartCorp.mockResolvedValue({
            corpCode: '00244455',
            matchedStockCode: '033780',
            viaCommonShare: false,
            corpName: '케이티앤지',
        });
        // 캐시 계층은 통과시키고 fetcher 결과와 TTL 함수를 그대로 노출한다.
        getOrSetCache.mockImplementation(
            async (_key: string, _ttl: unknown, fetcher: () => unknown) =>
                fetcher()
        );
    });

    it('작년 보고서가 있으면 그 연도를 쓰고 한 번만 묻는다', async () => {
        fetchAlotMatter.mockResolvedValue(KTNG_ROWS);
        expect(await fetchKrAnnualDividend('033780.KS', NOW)).toEqual({
            fiscalYear: 2025,
            dpsCommon: 6000,
            dartYieldPct: 4.1,
        });
        expect(fetchAlotMatter).toHaveBeenCalledTimes(1);
        expect(fetchAlotMatter).toHaveBeenCalledWith('00244455', 2025);
    });

    it('작년 보고서가 없으면(013 = null) 재작년으로 내려간다', async () => {
        fetchAlotMatter.mockImplementation(
            async (_corp: string, year: number) =>
                year === 2024 ? KTNG_ROWS : null
        );
        expect(await fetchKrAnnualDividend('033780.KS', NOW)).toMatchObject({
            fiscalYear: 2024,
            dpsCommon: 6000,
        });
        expect(fetchAlotMatter).toHaveBeenCalledTimes(2);
    });

    it('두 해 모두 없으면 null이다(맥쿼리인프라처럼 사업보고서 배당 항목이 없는 종목)', async () => {
        fetchAlotMatter.mockResolvedValue(null);
        expect(await fetchKrAnnualDividend('088980.KS', NOW)).toBeNull();
    });

    it('연도는 UTC가 아니라 KST 기준이다', async () => {
        fetchAlotMatter.mockResolvedValue(KTNG_ROWS);
        await fetchKrAnnualDividend(
            '033780.KS',
            new Date('2026-12-31T16:00:00Z') // 2027-01-01 01:00 KST
        );
        expect(fetchAlotMatter).toHaveBeenCalledWith('00244455', 2026);
    });

    it('캐시 키는 회사+사업연도이고, 있는 값은 7일·없는 값은 1일 TTL이다', async () => {
        fetchAlotMatter.mockResolvedValue(KTNG_ROWS);
        await fetchKrAnnualDividend('033780.KS', NOW);
        const [key, ttl] = getOrSetCache.mock.calls[0] as [
            string,
            (value: unknown) => number,
        ];
        expect(key).toBe('dart:alot-matter:v1:00244455:2025');
        expect(ttl({ fiscalYear: 2025 })).toBe(
            KR_ANNUAL_DIVIDEND_CACHE_TTL_SECONDS
        );
        expect(ttl(null)).toBe(KR_ANNUAL_DIVIDEND_MISSING_TTL_SECONDS);
    });

    it('우선주(보통주 코드로 매핑됨)는 보통주 배당을 내보내지 않는다', async () => {
        getKrDartCorp.mockResolvedValue({
            corpCode: '00244455',
            matchedStockCode: '033780',
            viaCommonShare: true,
            corpName: '케이티앤지',
        });
        expect(await fetchKrAnnualDividend('033785.KS', NOW)).toBeNull();
        expect(fetchAlotMatter).not.toHaveBeenCalled();
    });

    it('키가 없거나 회사 매핑이 없으면 DART를 부르지 않고 null이다', async () => {
        isDartEnabled.mockReturnValue(false);
        expect(await fetchKrAnnualDividend('033780.KS', NOW)).toBeNull();
        isDartEnabled.mockReturnValue(true);
        getKrDartCorp.mockResolvedValue(null);
        expect(await fetchKrAnnualDividend('069500.KS', NOW)).toBeNull();
        expect(fetchAlotMatter).not.toHaveBeenCalled();
    });

    it('최신 연도 DART 오류는 재작년으로 넘어가지 않고 null이다', async () => {
        fetchAlotMatter.mockImplementation(
            async (_corp: string, year: number) => {
                if (year === 2025) throw new Error('boom');
                return KTNG_ROWS;
            }
        );
        expect(await fetchKrAnnualDividend('033780.KS', NOW)).toBeNull();
        expect(fetchAlotMatter).toHaveBeenCalledTimes(1);
        expect(getOrSetCache).toHaveBeenCalledTimes(1);
    });

    it('Next 동적 서버 오류는 삼키지 않고 다시 던진다', async () => {
        fetchAlotMatter.mockRejectedValue(
            Object.assign(new Error('x'), { digest: 'DYNAMIC_SERVER_USAGE' })
        );
        await expect(
            fetchKrAnnualDividend('033780.KS', NOW)
        ).rejects.toMatchObject({ digest: 'DYNAMIC_SERVER_USAGE' });
    });

    it('DART 오류는 던지지 않고 null로 낮춘다', async () => {
        fetchAlotMatter.mockRejectedValue(new Error('boom'));
        expect(await fetchKrAnnualDividend('033780.KS', NOW)).toBeNull();
    });
});
