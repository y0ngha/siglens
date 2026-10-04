import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import { INDEXNOW_ENDPOINTS } from '@/shared/config/indexNow';
import { SITE_URL } from '@/shared/lib/seo';

const {
    mockSubmitIndexNow,
    mockIsIndexNowEnabled,
    mockLoadPopular,
    mockLoadCrypto,
    mockLoadStatic,
} = vi.hoisted(() => ({
    mockSubmitIndexNow: vi.fn(),
    mockIsIndexNowEnabled: vi.fn(),
    mockLoadPopular: vi.fn(),
    mockLoadCrypto: vi.fn(),
    mockLoadStatic: vi.fn(),
}));

vi.mock('@/shared/lib/indexNow', () => ({
    submitIndexNow: mockSubmitIndexNow,
    isIndexNowEnabled: mockIsIndexNowEnabled,
}));
vi.mock('@/app/api/sitemap/_shared/childEntries', () => ({
    loadPopularChildEntries: mockLoadPopular,
    loadCryptoChildEntries: mockLoadCrypto,
    loadStaticChildEntries: mockLoadStatic,
}));

import { submitIndexNowForBatch } from '../indexNowSubmission';

const NOW = new Date('2026-10-04T12:00:00Z');
const ZERO = { indexNowSubmitted: 0, indexNowOk: 0, indexNowFailed: 0 };

// 목은 로더만 대신한다 — 엔트리는 실제 sitemap 빌더가 만든다. 손으로 만든 엔트리는
// 빌더의 색인 판정(항상 noindex 탭 제외, 뉴스 산문 게이트)을 건너뛴다.
const symbolTabsWithProse = new Set(['AAPL:news']);

/** 제출 호출의 URL 목록. 호출 순서가 아니라 호출 자체를 단언한다. */
function submittedUrls(): readonly string[] {
    expect(mockSubmitIndexNow).toHaveBeenCalledTimes(1);
    return mockSubmitIndexNow.mock.calls[0]?.[0] as readonly string[];
}

describe('submitIndexNowForBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsIndexNowEnabled.mockReturnValue(true);
        mockSubmitIndexNow.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 0,
        });
        mockLoadPopular.mockResolvedValue(
            buildPopularEntries(NOW, { symbolTabsWithProse })
        );
        mockLoadCrypto.mockResolvedValue(
            buildCryptoPopularEntries(NOW, { symbolTabsWithProse })
        );
        mockLoadStatic.mockResolvedValue(buildStaticEntries(NOW));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('새로 구운 것이 없으면 아무것도 읽거나 보내지 않는다', async () => {
        const counts = await submitIndexNowForBatch({
            symbols: [],
            hubUrls: [],
            now: NOW,
        });

        expect(counts).toEqual(ZERO);
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(mockLoadStatic).not.toHaveBeenCalled();
    });

    it('IndexNow가 꺼진 환경(비운영)에서는 sitemap 입력(DB)도 읽지 않는다', async () => {
        mockIsIndexNowEnabled.mockReturnValue(false);

        const counts = await submitIndexNowForBatch({
            symbols: ['AAPL'],
            hubUrls: [`${SITE_URL}/market`],
            now: NOW,
        });

        expect(counts).toEqual(ZERO);
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(mockLoadCrypto).not.toHaveBeenCalled();
        expect(mockLoadStatic).not.toHaveBeenCalled();
    });

    it('심볼 하나를 구웠으면 그 심볼의 sitemap URL만 한 번에 제출한다', async () => {
        await submitIndexNowForBatch({
            symbols: ['AAPL'],
            hubUrls: [],
            now: NOW,
        });

        expect(submittedUrls()).toEqual([
            `${SITE_URL}/AAPL`,
            `${SITE_URL}/AAPL/news`,
            `${SITE_URL}/AAPL/fear-greed`,
        ]);
    });

    it('심볼이 sitemap에 싣지 않은 탭(산문 게이트 미통과 뉴스)은 제출하지 않는다', async () => {
        await submitIndexNowForBatch({
            symbols: ['MSFT'],
            hubUrls: [],
            now: NOW,
        });

        expect(submittedUrls()).toEqual([
            `${SITE_URL}/MSFT`,
            `${SITE_URL}/MSFT/fear-greed`,
        ]);
    });

    it('크립토 심볼은 크립토 sitemap 엔트리에서 고른다', async () => {
        await submitIndexNowForBatch({
            symbols: ['BTCUSD'],
            hubUrls: [],
            now: NOW,
        });

        expect(submittedUrls()).toContain(`${SITE_URL}/BTCUSD`);
        expect(submittedUrls()).toContain(`${SITE_URL}/BTCUSD/fear-greed`);
    });

    it('허브 URL은 정적 sitemap에 실린 것만 제출한다', async () => {
        await submitIndexNowForBatch({
            symbols: [],
            hubUrls: [
                `${SITE_URL}/market`,
                `${SITE_URL}/market/kr`,
                `${SITE_URL}/market/crypto`, // 페이지가 없는 허브 — sitemap에 없다
                `${SITE_URL}/economy/jp`, // 만들어 낸 경로
            ],
            now: NOW,
        });

        expect(submittedUrls()).toEqual([
            `${SITE_URL}/market`,
            `${SITE_URL}/market/kr`,
        ]);
    });

    it('정체돼 sitemap에서 빠진 뉴스 카테고리 허브는 새로 구웠어도 제출하지 않는다', async () => {
        const staleForex = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
        mockLoadStatic.mockResolvedValue(
            buildStaticEntries(NOW, {
                newsLatestPublishedAt: { forex: staleForex },
            })
        );

        await submitIndexNowForBatch({
            symbols: [],
            hubUrls: [`${SITE_URL}/news/forex`, `${SITE_URL}/news/stock`],
            now: NOW,
        });

        expect(submittedUrls()).toEqual([`${SITE_URL}/news/stock`]);
    });

    it('심볼 URL과 허브 URL을 한 번의 호출로 함께 제출한다', async () => {
        await submitIndexNowForBatch({
            symbols: ['AAPL'],
            hubUrls: [`${SITE_URL}/economy`],
            now: NOW,
        });

        expect(submittedUrls()).toEqual([
            `${SITE_URL}/AAPL`,
            `${SITE_URL}/AAPL/news`,
            `${SITE_URL}/AAPL/fear-greed`,
            `${SITE_URL}/economy`,
        ]);
    });

    it('허브만 구웠으면 종목 sitemap 입력은 읽지 않는다', async () => {
        await submitIndexNowForBatch({
            symbols: [],
            hubUrls: [`${SITE_URL}/market`],
            now: NOW,
        });

        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(mockLoadCrypto).not.toHaveBeenCalled();
    });

    it('걸러낸 뒤 보낼 URL이 하나도 없으면 제출을 부르지 않는다', async () => {
        const counts = await submitIndexNowForBatch({
            symbols: ['ZZZZ-NOT-LISTED'],
            hubUrls: [`${SITE_URL}/economy/jp`],
            now: NOW,
        });

        expect(counts).toEqual(ZERO);
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
    });

    it('제출 결과를 배치 카운트 이름으로 돌려준다', async () => {
        mockSubmitIndexNow.mockResolvedValue({
            submitted: 7,
            ok: 1,
            failed: 1,
        });

        const counts = await submitIndexNowForBatch({
            symbols: ['AAPL'],
            hubUrls: [],
            now: NOW,
        });

        expect(counts).toEqual({
            indexNowSubmitted: 7,
            indexNowOk: 1,
            indexNowFailed: 1,
        });
    });

    it('제출이 reject해도 던지지 않고 모든 엔드포인트를 실패로 센다', async () => {
        mockSubmitIndexNow.mockRejectedValue(new Error('unexpected'));

        await expect(
            submitIndexNowForBatch({
                symbols: ['AAPL'],
                hubUrls: [],
                now: NOW,
            })
        ).resolves.toEqual({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: INDEXNOW_ENDPOINTS.length,
        });
        expect(console.error).toHaveBeenCalledWith(
            '[indexnow] batch submission failed',
            expect.any(Error)
        );
    });

    it('sitemap 입력 로더가 던져도 배치를 막지 않는다', async () => {
        mockLoadPopular.mockRejectedValue(new Error('db down'));

        await expect(
            submitIndexNowForBatch({
                symbols: ['AAPL'],
                hubUrls: [],
                now: NOW,
            })
        ).resolves.toMatchObject({ indexNowFailed: INDEXNOW_ENDPOINTS.length });
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
    });

    it('입력 로딩까지 포함해 5초를 넘기면 기다리기를 포기하고 실패로 센다', async () => {
        vi.useFakeTimers();
        // 영영 끝나지 않는 제출 — 5초 상한이 없으면 크론 락을 계속 붙든다.
        mockSubmitIndexNow.mockReturnValue(new Promise(() => undefined));

        const pending = submitIndexNowForBatch({
            symbols: ['AAPL'],
            hubUrls: [],
            now: NOW,
        });
        await vi.advanceTimersByTimeAsync(4_999);
        const stillWaiting = await Promise.race([
            pending.then(() => 'settled'),
            Promise.resolve('waiting'),
        ]);
        await vi.advanceTimersByTimeAsync(1);

        expect(stillWaiting).toBe('waiting');
        await expect(pending).resolves.toEqual({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: INDEXNOW_ENDPOINTS.length,
        });
        expect(console.error).toHaveBeenCalledWith(
            '[indexnow] batch submission timed out after 5000ms'
        );
    });
});
