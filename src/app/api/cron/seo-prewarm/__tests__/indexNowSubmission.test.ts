import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import { INDEXNOW_ENDPOINTS } from '@/shared/config/indexNow';
import type { IndexNowQueueEntry } from '@/shared/lib/indexNowQueue';
import { SITE_URL } from '@/shared/lib/seo';

const {
    mockIsIndexNowEnabled,
    mockEnqueue,
    mockDrain,
    mockLoadPopular,
    mockLoadCrypto,
    mockLoadStatic,
    mockReadStaticLastmods,
    mockWriteStaticLastmods,
} = vi.hoisted(() => ({
    mockIsIndexNowEnabled: vi.fn(),
    mockEnqueue: vi.fn(),
    mockDrain: vi.fn(),
    mockLoadPopular: vi.fn(),
    mockLoadCrypto: vi.fn(),
    mockLoadStatic: vi.fn(),
    mockReadStaticLastmods: vi.fn(),
    mockWriteStaticLastmods: vi.fn(),
}));

vi.mock('@/shared/lib/indexNow', () => ({
    isIndexNowEnabled: mockIsIndexNowEnabled,
}));
vi.mock('@/shared/lib/indexNowQueue', () => ({
    enqueueIndexNow: mockEnqueue,
    drainIndexNow: mockDrain,
}));
vi.mock('@/app/api/sitemap/_shared/childEntries', () => ({
    loadPopularChildEntries: mockLoadPopular,
    loadCryptoChildEntries: mockLoadCrypto,
    loadStaticChildEntries: mockLoadStatic,
}));
vi.mock('../indexNowStaticPages', async importOriginal => ({
    ...(await importOriginal<typeof import('../indexNowStaticPages')>()),
    readStaticLastmods: mockReadStaticLastmods,
    writeStaticLastmods: mockWriteStaticLastmods,
}));

import { submitIndexNowForBatch } from '../indexNowSubmission';

const NOW = new Date('2026-10-04T12:00:00Z');
const HOUR = 3_600_000;
const MARGIN = 15 * 60_000;

// 목은 로더만 대신한다 — 엔트리는 실제 sitemap 빌더가 만든다. 손으로 만든 엔트리는
// 빌더의 색인 판정(항상 noindex 탭 제외, 뉴스 산문 게이트)을 건너뛴다.
// 키 = 렌더 가능한 산문이 있는 조합. 차트(technical)도 산문 게이트 대상이라 차트 URL이 실리려면 키가 필요하다.
// AAPL은 뉴스 산문까지, MSFT·BTCUSD는 차트 산문만 있다(뉴스 탭은 sitemap에서 빠진다).
const snapshotGeneratedAt = new Map<string, Date>([
    ['AAPL:news', NOW],
    ['AAPL:technical', NOW],
    ['MSFT:technical', NOW],
    ['BTCUSD:technical', NOW],
]);

/** 정적 페이지가 이미 시드돼 있는 상태 — 정적 페이지가 큐에 섞여 들어오지 않게. */
function seededStaticLastmods(): Record<string, string> {
    return Object.fromEntries(
        buildStaticEntries(NOW)
            .filter(entry =>
                [
                    '/about',
                    '/methodology',
                    '/privacy',
                    '/terms',
                    '/backtesting',
                ].some(path => entry.url === `${SITE_URL}${path}`)
            )
            .map(entry => [entry.url, entry.lastModified!.toISOString()])
    );
}

/** `enqueueIndexNow`에 넘어간 엔트리. 호출 순서가 아니라 호출 자체를 단언한다. */
function enqueued(): IndexNowQueueEntry[] {
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    // 배치가 넘긴 `now`로 이 배치의 호출을 찾는다(호출 인덱스에 기대지 않는다).
    const call = mockEnqueue.mock.calls.find(
        ([, at]) => at instanceof Date && at.getTime() === NOW.getTime()
    );
    expect(call).toBeDefined();
    return call?.[0] as IndexNowQueueEntry[];
}

/** 비어 있지 않은 정적 페이지 시드 갱신 호출의 인자(갱신 내용으로 호출을 찾는다). */
function writtenStaticLastmods(): Record<string, string> {
    const call = mockWriteStaticLastmods.mock.calls.find(
        ([updates]) => Object.keys(updates ?? {}).length > 0
    );
    expect(call).toBeDefined();
    return call?.[0] as Record<string, string>;
}

function enqueuedUrls(): string[] {
    return enqueued().map(entry => entry.url);
}

function notBeforeOf(url: string): number | undefined {
    return enqueued().find(entry => entry.url === url)?.notBeforeMs;
}

describe('submitIndexNowForBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsIndexNowEnabled.mockReturnValue(true);
        mockEnqueue.mockResolvedValue(0);
        mockWriteStaticLastmods.mockResolvedValue(undefined);
        mockReadStaticLastmods.mockResolvedValue(seededStaticLastmods());
        mockDrain.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 0,
            skipped: null,
            outcome: { kind: 'ok' },
        });
        mockLoadPopular.mockResolvedValue(
            buildPopularEntries(NOW, { snapshotGeneratedAt })
        );
        mockLoadCrypto.mockResolvedValue(
            buildCryptoPopularEntries(NOW, { snapshotGeneratedAt })
        );
        mockLoadStatic.mockResolvedValue(buildStaticEntries(NOW));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('꺼진 환경에서는 입력을 읽지도 큐에 넣지도 않는다', async () => {
        mockIsIndexNowEnabled.mockReturnValue(false);

        await expect(
            submitIndexNowForBatch({
                harvested: [{ symbol: 'AAPL', tabs: ['technical'] }],
                hubUrls: [],
                now: NOW,
            })
        ).resolves.toEqual({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: 0,
        });
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockDrain).not.toHaveBeenCalled();
    });

    it('빈 tick에도 만기분 drain은 한다 — 종목 DB는 읽지 않는다', async () => {
        await submitIndexNowForBatch({
            harvested: [],
            hubUrls: [],
            now: NOW,
        });

        expect(mockDrain).toHaveBeenCalledTimes(1);
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(mockLoadCrypto).not.toHaveBeenCalled();
        expect(enqueued()).toEqual([]);
    });

    it('harvest된 탭의 URL만 큐에 넣는다 — 차트만 굽혔으면 뉴스 URL은 없다', async () => {
        await submitIndexNowForBatch({
            harvested: [{ symbol: 'AAPL', tabs: ['technical'] }],
            hubUrls: [],
            now: NOW,
        });

        expect(enqueuedUrls()).toEqual([`${SITE_URL}/AAPL`]);
    });

    it('차트는 6시간, 뉴스 탭은 12시간(+15분) 뒤가 제출 시각이다', async () => {
        await submitIndexNowForBatch({
            harvested: [{ symbol: 'AAPL', tabs: ['technical', 'news'] }],
            hubUrls: [],
            now: NOW,
        });

        expect(notBeforeOf(`${SITE_URL}/AAPL`)).toBe(
            NOW.getTime() + 6 * HOUR + MARGIN
        );
        expect(notBeforeOf(`${SITE_URL}/AAPL/news`)).toBe(
            NOW.getTime() + 12 * HOUR + MARGIN
        );
    });

    it('심볼이 sitemap에 싣지 않은 탭(산문 게이트 미통과 뉴스)은 큐에 넣지 않는다', async () => {
        mockLoadPopular.mockResolvedValue(
            buildPopularEntries(NOW, {
                snapshotGeneratedAt: new Map([['AAPL:technical', NOW]]),
            })
        );

        await submitIndexNowForBatch({
            harvested: [{ symbol: 'AAPL', tabs: ['technical', 'news'] }],
            hubUrls: [],
            now: NOW,
        });

        expect(enqueuedUrls()).not.toContain(`${SITE_URL}/AAPL/news`);
        expect(enqueuedUrls()).toContain(`${SITE_URL}/AAPL`);
    });

    it('크립토 심볼은 크립토 sitemap 엔트리에서 고른다', async () => {
        await submitIndexNowForBatch({
            harvested: [{ symbol: 'BTCUSD', tabs: ['technical'] }],
            hubUrls: [],
            now: NOW,
        });

        expect(enqueuedUrls()).toEqual([`${SITE_URL}/BTCUSD`]);
    });

    it('허브 URL은 정적 sitemap에 실린 것만 큐에 넣고, 크론이 태그를 털었으니 한 주기 뒤다', async () => {
        await submitIndexNowForBatch({
            harvested: [],
            hubUrls: [`${SITE_URL}/market`, `${SITE_URL}/no-such-hub`],
            now: NOW,
        });

        expect(enqueuedUrls()).toEqual([`${SITE_URL}/market`]);
        expect(notBeforeOf(`${SITE_URL}/market`)).toBe(
            NOW.getTime() + 6 * HOUR + MARGIN
        );
    });

    it('정체돼 sitemap에서 빠진 뉴스 카테고리 허브는 새로 구웠어도 큐에 넣지 않는다', async () => {
        const stale = new Date(NOW.getTime() - 30 * 86_400_000);
        mockLoadStatic.mockResolvedValue(
            buildStaticEntries(NOW, {
                // 로더가 성공한 입력 — 키가 없는 카테고리(기사 0건)는 빠진다. stock만 최신이다.
                newsLatestPublishedAt: { forex: stale, stock: NOW },
            })
        );

        await submitIndexNowForBatch({
            harvested: [],
            hubUrls: [`${SITE_URL}/news/forex`],
            now: NOW,
        });

        expect(enqueuedUrls()).not.toContain(`${SITE_URL}/news/forex`);
    });

    it('본문이 바뀐 것으로만 확인된 허브(크론이 태그를 안 텀)는 두 주기 뒤다', async () => {
        await submitIndexNowForBatch({
            harvested: [],
            hubUrls: [],
            changedHubUrls: [`${SITE_URL}/market/kr`],
            now: NOW,
        });

        expect(notBeforeOf(`${SITE_URL}/market/kr`)).toBe(
            NOW.getTime() + 12 * HOUR + MARGIN
        );
    });

    describe('정적 페이지 lastmod 감시', () => {
        it('저장된 값이 없으면(첫 실행) 다섯 페이지를 시드하며 큐에 넣는다 — 두 주기 지연', async () => {
            mockReadStaticLastmods.mockResolvedValue({});

            await submitIndexNowForBatch({
                harvested: [],
                hubUrls: [],
                now: NOW,
            });

            expect(enqueuedUrls().toSorted()).toEqual(
                [
                    `${SITE_URL}/about`,
                    `${SITE_URL}/backtesting`,
                    `${SITE_URL}/methodology`,
                    `${SITE_URL}/privacy`,
                    `${SITE_URL}/terms`,
                ].toSorted()
            );
            expect(notBeforeOf(`${SITE_URL}/about`)).toBe(
                NOW.getTime() + 48 * HOUR + MARGIN
            );
            const written = writtenStaticLastmods();
            expect(Object.keys(written)).toHaveLength(5);
        });

        it('바뀐 페이지만 큐에 넣고 시드를 갱신한다', async () => {
            const seeded = seededStaticLastmods();
            seeded[`${SITE_URL}/terms`] = '2020-01-01T00:00:00.000Z';
            mockReadStaticLastmods.mockResolvedValue(seeded);

            await submitIndexNowForBatch({
                harvested: [],
                hubUrls: [],
                now: NOW,
            });

            expect(enqueuedUrls()).toEqual([`${SITE_URL}/terms`]);
            expect(Object.keys(writtenStaticLastmods())).toEqual([
                `${SITE_URL}/terms`,
            ]);
        });

        it('큐 쓰기가 실패하면 시드를 갱신하지 않는다 — 다음 tick이 다시 넣는다', async () => {
            mockReadStaticLastmods.mockResolvedValue({});
            mockEnqueue.mockRejectedValue(new Error('redis down'));

            await submitIndexNowForBatch({
                harvested: [],
                hubUrls: [],
                now: NOW,
            });

            expect(mockWriteStaticLastmods).not.toHaveBeenCalled();
        });
    });

    it('drain 결과를 배치 카운트 이름으로 돌려준다', async () => {
        mockDrain.mockResolvedValue({
            submitted: 5,
            ok: 1,
            failed: 1,
            skipped: null,
            outcome: { kind: 'transient', status: 503 },
        });

        await expect(
            submitIndexNowForBatch({
                harvested: [],
                hubUrls: [],
                now: NOW,
            })
        ).resolves.toEqual({
            indexNowSubmitted: 5,
            indexNowOk: 1,
            indexNowFailed: 1,
        });
    });

    it('입력 로더가 던져도 기존 큐는 drain한다 — 배치를 막지 않는다', async () => {
        mockLoadPopular.mockRejectedValue(new Error('db down'));

        await expect(
            submitIndexNowForBatch({
                harvested: [{ symbol: 'AAPL', tabs: ['technical'] }],
                hubUrls: [],
                now: NOW,
            })
        ).resolves.toEqual({
            indexNowSubmitted: 3,
            indexNowOk: 1,
            indexNowFailed: 0,
        });
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockDrain).toHaveBeenCalledTimes(1);
    });

    it('drain이 reject해도 던지지 않고 모든 엔드포인트를 실패로 센다', async () => {
        mockDrain.mockRejectedValue(new Error('unexpected'));

        await expect(
            submitIndexNowForBatch({
                harvested: [],
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

    it('입력 로딩·큐·제출까지 포함해 5초를 넘기면 기다리기를 포기하고 실패로 센다 — 큐는 지우지 않는다', async () => {
        vi.useFakeTimers();
        // 영영 끝나지 않는 drain — 5초 상한이 없으면 크론 락을 계속 붙든다.
        mockDrain.mockReturnValue(new Promise(() => undefined));

        const pending = submitIndexNowForBatch({
            harvested: [],
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
