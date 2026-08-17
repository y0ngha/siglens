import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetKoreanNames, capturedResolvers } = vi.hoisted(() => ({
    mockGetKoreanNames: vi.fn(),
    capturedResolvers: [] as ((symbol: string) => Promise<string | null>)[],
}));

vi.mock('@/entities/ticker/lib/koreanNameStore', () => ({
    getKoreanNames: mockGetKoreanNames,
}));

vi.mock('../lib/naverNewsClient', () => ({
    NaverNewsClient: class {
        constructor(resolveQuery: (symbol: string) => Promise<string | null>) {
            capturedResolvers.push(resolveQuery);
        }
    },
}));

import { getNewsClient } from '../lib/getNewsClient';

/**
 * 국내 종목 뉴스 검색어는 한글 종목명이어야 한다 — 종목코드로 검색하면 기사가 거의
 * 잡히지 않는다. 종전에는 `korean_tickers`만 봤는데, `/005930.KS/news`가 `/005930.KS`보다
 * 먼저 생성되는 콜드 스타트에서는 아직 행이 없어 검색 자체가 건너뛰어졌고 **빈 뉴스
 * 페이지가 ISR에 12시간 굳었다**. sitemap은 그 URL을 `hourly`/0.78로 광고하는 중이다.
 * 제목 경로는 같은 이유로 이미 큐레이션 카탈로그를 폴백으로 쓰고 있었다.
 */
describe('getNewsClient — 국내 종목 검색어 해석', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NAVER_CLIENT_ID = 'id';
        process.env.NAVER_CLIENT_SECRET = 'secret';
        delete process.env.E2E_TEST;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    /**
     * `getNewsClient`는 naver 클라이언트를 모듈 레벨 싱글톤으로 캐시하므로 resolver는
     * 첫 호출에서 한 번만 잡힌다. 두 번째부터는 생성자가 돌지 않는다.
     */
    function resolverFor(): (symbol: string) => Promise<string | null> {
        getNewsClient('naver');
        const resolver = capturedResolvers[0];
        expect(resolver).toBeDefined();
        return resolver!;
    }

    it('DB에 한글명이 있으면 그 값을 쓴다', async () => {
        mockGetKoreanNames.mockResolvedValue({ '005930.KS': '삼성전자' });
        const resolve = resolverFor();
        await expect(resolve('005930.KS')).resolves.toBe('삼성전자');
    });

    it('DB가 비어 있어도 큐레이션 카탈로그로 폴백한다', async () => {
        mockGetKoreanNames.mockResolvedValue({});
        const resolve = resolverFor();
        await expect(resolve('005930.KS')).resolves.toBe('삼성전자');
    });

    it('소문자 심볼도 폴백에 걸린다', async () => {
        mockGetKoreanNames.mockResolvedValue({});
        const resolve = resolverFor();
        await expect(resolve('005930.ks')).resolves.toBe('삼성전자');
    });

    it('카탈로그에도 없으면 null — 영문명으로 헛검색하지 않는다', async () => {
        mockGetKoreanNames.mockResolvedValue({});
        const resolve = resolverFor();
        await expect(resolve('999999.KS')).resolves.toBeNull();
    });
});
