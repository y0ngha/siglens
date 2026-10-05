/**
 * sitemap lastmod 주입값 로더.
 *
 * 핵심 계약은 **fail-soft**다: DB가 죽어도 sitemap은 계속 나가야 한다(빌더가
 * `SITE_BUILD_DATE`/UTC 일 경계로 폴백한다). 여기서 throw하면 sitemap 전체가
 * 500이 되고, 그건 lastmod 한 칸이 덜 정확한 것보다 훨씬 나쁘다.
 */
const { mockListLatest, mockFindActive, mockGetDatabaseClient } = vi.hoisted(
    () => ({
        mockListLatest: vi.fn(),
        mockFindActive: vi.fn(),
        mockGetDatabaseClient: vi.fn(() => ({ db: {} })),
    })
);

vi.mock('next/cache', () => ({
    // real `unstable_cache` JSON-serializes its return value, which turns every
    // `Date` into an ISO string — round-trip through JSON so this test catches
    // that class of bug instead of passing the value through untouched.
    unstable_cache: (fn: () => Promise<unknown>) => async () =>
        JSON.parse(JSON.stringify(await fn())),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    DrizzleMarketNewsRepository: class {
        listLatestPublishedAt = mockListLatest;
    },
}));
vi.mock('@/entities/terms/api', () => ({
    DrizzleTermsRepository: class {
        findActive = mockFindActive;
    },
}));

import { loadStaticSitemapInputs } from '../server';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';
import { buildStaticEntries } from '../lib/buildStaticEntries';
import { maxLastModified } from '../lib/maxLastModified';

const CRYPTO_AT = new Date('2026-05-23T11:00:00.000Z');
const TOS_AT = new Date('2026-09-14T00:00:00.000Z');

describe('loadStaticSitemapInputs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListLatest.mockResolvedValue(new Map());
        mockFindActive.mockResolvedValue(null);
    });

    it('센티널 결과를 카테고리 id로 되돌려 준다', async () => {
        mockListLatest.mockResolvedValue(
            new Map([[CATEGORY_CONFIG.crypto.sentinel, CRYPTO_AT]])
        );

        const inputs = await loadStaticSitemapInputs();

        // 캐시(JSON 직렬화)를 거쳐도 Date로 복원돼야 한다 — 문자열이면
        // buildStaticEntries가 `.getTime()`을 호출하다 터진다.
        expect(inputs.newsLatestPublishedAt?.crypto).toBeInstanceOf(Date);
        expect(inputs.newsLatestPublishedAt).toEqual({ crypto: CRYPTO_AT });
    });

    it('활성 약관의 발효일을 kind별로 담는다', async () => {
        mockFindActive.mockImplementation(async (kind: string) =>
            kind === 'tos' ? { effectiveDate: TOS_AT } : null
        );

        const inputs = await loadStaticSitemapInputs();

        expect(inputs.legalEffectiveDates?.tos).toBeInstanceOf(Date);
        expect(inputs.legalEffectiveDates).toEqual({ tos: TOS_AT });
    });

    it('캐시를 거친 값도 buildStaticEntries + maxLastModified가 그대로 받는다', async () => {
        mockListLatest.mockResolvedValue(
            new Map([[CATEGORY_CONFIG.crypto.sentinel, CRYPTO_AT]])
        );
        mockFindActive.mockImplementation(async (kind: string) =>
            kind === 'tos' ? { effectiveDate: TOS_AT } : null
        );

        const inputs = await loadStaticSitemapInputs();

        const entries = buildStaticEntries(new Date(), inputs);
        expect(() => maxLastModified(entries, new Date())).not.toThrow();
    });

    it('뉴스 조회가 실패해도 약관 값은 살아남는다 — 뉴스 입력은 `{}`가 아니라 **없음**이다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockListLatest.mockRejectedValue(new Error('neon down'));
        mockFindActive.mockResolvedValue({ effectiveDate: TOS_AT });

        const inputs = await loadStaticSitemapInputs();

        // `{}`(로더 성공, 기사 0건)와 구별돼야 한다 — 빌더는 `{}`면 모든 뉴스 카테고리를 뺀다.
        expect(inputs).not.toHaveProperty('newsLatestPublishedAt');
        expect(inputs.legalEffectiveDates).toEqual({
            privacy: TOS_AT,
            tos: TOS_AT,
        });
        spy.mockRestore();
    });

    it('뉴스 조회 실패는 캐시에 저장되지 않는다 — 다음 호출이 다시 읽는다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockListLatest.mockRejectedValueOnce(new Error('neon blip'));
        mockListLatest.mockResolvedValue(
            new Map([[CATEGORY_CONFIG.crypto.sentinel, CRYPTO_AT]])
        );

        const first = await loadStaticSitemapInputs();
        const second = await loadStaticSitemapInputs();

        expect(first).not.toHaveProperty('newsLatestPublishedAt');
        expect(second.newsLatestPublishedAt).toEqual({ crypto: CRYPTO_AT });
        spy.mockRestore();
    });

    it('기사가 하나도 없으면 빈 객체다(로더 성공) — 실패(없음)와 다르다', async () => {
        const inputs = await loadStaticSitemapInputs();

        expect(inputs.newsLatestPublishedAt).toEqual({});
    });

    it('DB 클라이언트 자체가 죽으면 빈 옵션을 돌려준다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetDatabaseClient.mockImplementation(() => {
            throw new Error('no DATABASE_URL');
        });

        await expect(loadStaticSitemapInputs()).resolves.toEqual({});
        mockGetDatabaseClient.mockImplementation(() => ({ db: {} }));
        spy.mockRestore();
    });
});
