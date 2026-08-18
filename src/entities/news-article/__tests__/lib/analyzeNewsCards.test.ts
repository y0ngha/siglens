import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';

const { mockRunNewsCardAnalysis } = vi.hoisted(() => ({
    mockRunNewsCardAnalysis: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return { ...actual, runNewsCardAnalysis: mockRunNewsCardAnalysis };
});

import { analyzeNewsCards } from '@/entities/news-article/lib/analyzeNewsCards';
import type { DrizzleNewsRepository } from '@/entities/news-article/api';

const ANALYSIS: NewsCardAnalysis = {
    titleKo: '애플 사상 최고가',
    bodyKo: '주가가 신기록을 세웠다.',
    summaryKo: '애플 주가 신기록.',
    sentiment: 'bullish',
    category: 'other',
    priceImpact: 'medium',
};

function item(id: string, publishedAt: string): NewsItem {
    return {
        id,
        symbol: 'AAPL',
        source: 'Reuters',
        url: `https://example.com/${id}`,
        publishedAt,
        titleEn: `title ${id}`,
        bodyEn: `body ${id}`,
    };
}

function makeRepo() {
    const attachAnalysis = vi.fn().mockResolvedValue(undefined);
    return {
        repo: { attachAnalysis } as unknown as DrizzleNewsRepository,
        attachAnalysis,
    };
}

/**
 * 이 함수가 없으면 뉴스·종합 탭의 SEO 스냅샷이 통째로 생성되지 않는다 —
 * `isEnrichedRow`가 미보강 행을 전부 걸러내 core가 `no_news`로 떨어진다.
 * 그래서 "얼마나 분석했나"보다 **"분석 대상을 빠뜨리지 않는가"** 가 핵심 계약이다.
 */
describe('analyzeNewsCards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRunNewsCardAnalysis.mockResolvedValue({
            status: 'done',
            result: ANALYSIS,
        });
    });

    it('후보 전부를 분석해 DB에 반영한다', async () => {
        const { repo, attachAnalysis } = makeRepo();
        await analyzeNewsCards(
            [
                item('a', '2026-08-01T00:00:00Z'),
                item('b', '2026-08-02T00:00:00Z'),
            ],
            repo,
            { logLabel: 'test' }
        );

        expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(2);
        expect(attachAnalysis).toHaveBeenCalledTimes(2);
        expect(attachAnalysis.mock.calls.map(c => c[0]).toSorted()).toEqual([
            'a',
            'b',
        ]);
    });

    it('후보가 없으면 LLM을 부르지 않는다', async () => {
        const { repo, attachAnalysis } = makeRepo();
        await analyzeNewsCards([], repo, { logLabel: 'test' });

        expect(mockRunNewsCardAnalysis).not.toHaveBeenCalled();
        expect(attachAnalysis).not.toHaveBeenCalled();
    });

    describe('limit', () => {
        // prewarm cron은 유닛 타임아웃(2분) 안에서 돌아야 하고, 어차피
        // `selectAggregateNewsItems`가 상위 N건만 쓴다.
        it('상한을 넘으면 최신 기사부터 남기고 자른다', async () => {
            const { repo } = makeRepo();
            await analyzeNewsCards(
                [
                    item('old', '2026-08-01T00:00:00Z'),
                    item('newest', '2026-08-05T00:00:00Z'),
                    item('mid', '2026-08-03T00:00:00Z'),
                ],
                repo,
                { logLabel: 'test', limit: 2 }
            );

            const analyzedIds = mockRunNewsCardAnalysis.mock.calls
                .map(c => c[0].item.id)
                .toSorted();
            expect(analyzedIds).toEqual(['mid', 'newest']);
        });

        it('상한이 없으면 자르지 않는다 — 방문자 경로는 마감이 없다', async () => {
            const { repo } = makeRepo();
            await analyzeNewsCards(
                [
                    item('a', '2026-08-01T00:00:00Z'),
                    item('b', '2026-08-02T00:00:00Z'),
                    item('c', '2026-08-03T00:00:00Z'),
                ],
                repo,
                { logLabel: 'test' }
            );

            expect(mockRunNewsCardAnalysis).toHaveBeenCalledTimes(3);
        });
    });

    describe('실패 격리', () => {
        it('한 건이 던져도 나머지는 저장되고 위로 던지지 않는다', async () => {
            const { repo, attachAnalysis } = makeRepo();
            mockRunNewsCardAnalysis.mockImplementation(
                ({ item: i }: { item: NewsItem }) =>
                    i.id === 'bad'
                        ? Promise.reject(new Error('LLM down'))
                        : Promise.resolve({ status: 'done', result: ANALYSIS })
            );

            await expect(
                analyzeNewsCards(
                    [
                        item('bad', '2026-08-01T00:00:00Z'),
                        item('good', '2026-08-02T00:00:00Z'),
                    ],
                    repo,
                    { logLabel: 'test' }
                )
            ).resolves.toBeUndefined();

            expect(attachAnalysis).toHaveBeenCalledTimes(1);
            expect(attachAnalysis.mock.calls[0]![0]).toBe('good');
        });

        it('titleKo·summaryKo가 둘 다 비면 저장하지 않는다 — fallback 영구 고착 방지', async () => {
            // 저장하면 analyzedAt이 찍혀 이 기사는 두 번 다시 분석되지 않고
            // 빈 값이 그대로 굳는다. DB를 손대기 전엔 복구 불가.
            const { repo, attachAnalysis } = makeRepo();
            mockRunNewsCardAnalysis.mockResolvedValue({
                status: 'done',
                result: { ...ANALYSIS, titleKo: '  ', summaryKo: '' },
            });

            await analyzeNewsCards([item('a', '2026-08-01T00:00:00Z')], repo, {
                logLabel: 'test',
            });

            expect(attachAnalysis).not.toHaveBeenCalled();
        });

        it('titleKo만 있으면 저장한다 — 모델이 실제로 만든 결과다', async () => {
            const { repo, attachAnalysis } = makeRepo();
            mockRunNewsCardAnalysis.mockResolvedValue({
                status: 'done',
                result: { ...ANALYSIS, summaryKo: '' },
            });

            await analyzeNewsCards([item('a', '2026-08-01T00:00:00Z')], repo, {
                logLabel: 'test',
            });

            expect(attachAnalysis).toHaveBeenCalledTimes(1);
        });
    });
});
