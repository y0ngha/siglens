// 1. vi.mock 선언 — Vitest가 정적 import 전에 호이스팅한다.

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/api/isBot', () => ({ isBot: vi.fn(() => false) }));

// runMarketNewsDigest만 스텁하고 나머지 core 모듈은 원본을 유지한다.
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    runMarketNewsDigest: vi.fn(),
    peekMarketNewsDigestCache: vi.fn(),
}));

// 생성 쿨다운 — 기본은 "캐시 miss + 슬롯 획득"(아래 beforeEach). 쿨다운 분기는
// '생성 쿨다운' describe에서 바꾼다.
vi.mock('@/entities/market-news/api/marketNewsDigestCooldown', () => ({
    tryAcquireMarketNewsDigestSlot: vi.fn(),
    releaseMarketNewsDigestSlot: vi.fn(),
    readLatestMarketNewsDigest: vi.fn(),
    writeLatestMarketNewsDigest: vi.fn(),
}));

// getMarketNewsList는 enriched row 형태의 최소 픽스처를 반환한다.
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    getMarketNewsList: vi.fn(async () => [
        {
            id: 'm1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://x/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC ETF inflows',
            titleKo: 'BTC ETF 유입',
            bodyEn: 'body text',
            bodyKo: null,
            summaryKo: '유입',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
            analyzedAt: new Date(),
        },
    ]),
}));

// isEnrichedRow / toEnrichedNewsItem / selectAggregateNewsItems는 픽스처 row를
// 그대로 통과시킨다 — 이 파일이 테스트하는 대상은 데이터 변환 로직이 아니라
// skipEnqueueIfMiss 분기와 core 위임 동작이다.
vi.mock('@/entities/news-article/lib/newsEnrichment', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/news-article/lib/newsEnrichment')
    >()),
    isEnrichedRow: vi.fn(() => true),
    toEnrichedNewsItem: vi.fn((row: unknown) => row),
}));
vi.mock(
    '@/entities/news-article/lib/newsAnalysisSelection',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/news-article/lib/newsAnalysisSelection')
        >()),
        selectAggregateNewsItems: vi.fn((items: unknown[]) => items),
    })
);

// 2. 정적 import — vi.mock 선언 이후에 배치한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import koMessages from '../../../../messages/ko.json';
import { isBot } from '@/shared/api/isBot';
import * as core from '@y0ngha/siglens-core';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import {
    readLatestMarketNewsDigest,
    releaseMarketNewsDigestSlot,
    tryAcquireMarketNewsDigestSlot,
    writeLatestMarketNewsDigest,
} from '@/entities/market-news/api/marketNewsDigestCooldown';
import { getMarketNewsList } from '@/entities/market-news/api/marketNewsRepository';

// 3. 테스트

describe('submitMarketNewsDigestAction은', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(core.peekMarketNewsDigestCache).mockResolvedValue(null);
        vi.mocked(tryAcquireMarketNewsDigestSlot).mockResolvedValue(true);
        vi.mocked(readLatestMarketNewsDigest).mockResolvedValue(null);
    });

    /**
     * 2026-09-27: `skipEnqueueIfMiss`는 더 이상 `isBot(...)`으로 갈리지 않는다
     * — 크롤러도 사람과 같은 다이제스트를 받아야 한다(route.ts 상단 불변식).
     * `isBot`을 true로 목킹해도 `false`가 나와야 한다는 게 회귀 가드다:
     * `isBot(...)` 기반 분기가 되돌아오면 이 테스트가 `true`를 보고 실패한다.
     */
    it('isBot이 true를 반환해도 skipEnqueueIfMiss=false로 core를 호출한다', async () => {
        vi.mocked(isBot).mockReturnValue(true);
        vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
            status: 'miss_no_trigger',
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        await submitMarketNewsDigestAction('crypto', 'ko');

        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({
                skipEnqueueIfMiss: false,
                category: 'crypto',
                // CATEGORY_CONFIG['crypto'].koLabel — 실제 값으로 검증한다.
                categoryLabel: '암호화폐',
            })
        );
    });

    it('사람이면 skipEnqueueIfMiss=false로 core를 호출한다', async () => {
        // isBot 기본값은 false이지만, 봇 테스트와 독립적임을 명시한다.
        vi.mocked(isBot).mockReturnValue(false);
        vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
            status: 'done',
            result: {
                currentDriverKo: '흐름',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'bullish',
            },
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto', 'ko');

        // 결과가 core의 반환값을 그대로 전달한다.
        expect(r.status).toBe('done');
        // 사람 경로에서 enqueue를 차단하면 안 된다.
        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    it('추론 끔(DIGEST_REASONING=false)과 DeepSeek 기본 모델로 core를 호출한다', async () => {
        // 2026-10-01 다이제스트 추론을 껐다(`DIGEST_REASONING` 주석). 값 자체를 고정해
        // 두는 이유: 캐시 키 성분이라 누가 무심코 켜면 전 카테고리가 새 키로 재생성되고
        // 비용이 다시 오른다 — 그 변경이 이 단언에서 드러나게 한다.
        vi.mocked(isBot).mockReturnValue(false);
        vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
            status: 'done',
            result: {
                currentDriverKo: '흐름',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'bullish',
            },
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        await submitMarketNewsDigestAction('crypto', 'ko');

        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({
                reasoning: false,
                modelId: DEFAULT_DIGEST_MODEL_ID,
            })
        );
        expect(core.MODEL_SPECS[DEFAULT_DIGEST_MODEL_ID].provider).toBe(
            'deepseek'
        );
    });

    it('core가 cached를 반환하면 그대로 전달한다', async () => {
        vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
            status: 'cached',
            result: {
                currentDriverKo: '흐름',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'bullish',
            },
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto', 'ko');

        expect(r.status).toBe('cached');
    });

    it('예외 발생 시 throw하지 않고 error 상태를 반환한다', async () => {
        vi.mocked(core.runMarketNewsDigest).mockRejectedValue(
            new Error('core error')
        );

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto', 'ko');

        expect(r.status).toBe('error');
        expect((r as { status: 'error'; error: string }).error).toBe(
            koMessages.app.api.stream.digestFailed
        );
    });

    it('알 수 없는 카테고리는 core 호출 없이 error 상태를 반환한다', async () => {
        // TypeScript 타입 경계 밖의 값 — 런타임 직렬화(SSE 파라미터 등)에서 발생할 수 있다.
        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction(
            'unknown_category' as unknown as import('@y0ngha/siglens-core').NewsFeedCategory,
            'ko'
        );

        expect(r.status).toBe('error');
        // CATEGORY_CONFIG에 없는 키이므로 core가 호출되어서는 안 된다.
        expect(core.runMarketNewsDigest).not.toHaveBeenCalled();
    });
    /**
     * 생성 쿨다운(2026-10 비용 감사). core 키가 기사 목록에서 파생돼 새 기사가
     * 분석될 때마다 갈리므로, 키 miss마다 생성하던 때는 그때마다 LLM을 불렀다.
     */
    describe('생성 쿨다운', () => {
        const DIGEST = {
            currentDriverKo: '흐름',
            keyEventsKo: [],
            upcomingEventsKo: [],
            overallSentiment: 'bullish',
        } as const;

        it('캐시 hit이면 슬롯을 잡지 않고 core의 cached 결과를 돌려준다', async () => {
            vi.mocked(core.peekMarketNewsDigestCache).mockResolvedValue(
                DIGEST as never
            );
            vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
                status: 'cached',
                result: DIGEST as never,
            });

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r.status).toBe('cached');
            expect(tryAcquireMarketNewsDigestSlot).not.toHaveBeenCalled();
            expect(writeLatestMarketNewsDigest).not.toHaveBeenCalled();
        });

        it('miss + 슬롯 획득이면 생성하고 마지막 생성본을 남긴다', async () => {
            vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
                status: 'done',
                result: DIGEST as never,
            });

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'en');

            expect(r.status).toBe('done');
            expect(tryAcquireMarketNewsDigestSlot).toHaveBeenCalledWith(
                'crypto',
                'en'
            );
            expect(writeLatestMarketNewsDigest).toHaveBeenCalledWith(
                'crypto',
                'en',
                DIGEST
            );
        });

        it('miss + 슬롯을 못 잡으면 core 호출 없이 마지막 생성본을 cached로 돌려준다', async () => {
            vi.mocked(tryAcquireMarketNewsDigestSlot).mockResolvedValue(false);
            vi.mocked(readLatestMarketNewsDigest).mockResolvedValue(
                DIGEST as never
            );

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r).toEqual({ status: 'cached', result: DIGEST });
            expect(core.runMarketNewsDigest).not.toHaveBeenCalled();
        });

        it('슬롯을 못 잡았는데 마지막 생성본도 없으면 생성한다(콜드 스타트)', async () => {
            vi.mocked(tryAcquireMarketNewsDigestSlot).mockResolvedValue(false);
            vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
                status: 'done',
                result: DIGEST as never,
            });

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r.status).toBe('done');
            expect(writeLatestMarketNewsDigest).toHaveBeenCalled();
        });

        it('슬롯을 잡은 생성이 실패하면 슬롯을 돌려준다', async () => {
            vi.mocked(core.runMarketNewsDigest).mockRejectedValue(
                new Error('llm down')
            );

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r.status).toBe('error');
            expect(releaseMarketNewsDigestSlot).toHaveBeenCalledWith(
                'crypto',
                'ko'
            );
        });

        // core `RunMarketNewsDigestResult`는 던지지 않고도 LLM을 부르지 않은 상태를
        // 돌려줄 수 있다 — 잡은 슬롯을 쥐고 있으면 비용 없이 1시간 동안 생성이 막힌다.
        it.each(['miss_no_trigger', 'no_news'] as const)(
            '슬롯을 잡았는데 core가 %s를 돌려주면(LLM 미호출) 슬롯을 돌려준다',
            async status => {
                vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
                    status,
                });

                const { submitMarketNewsDigestAction } =
                    await import('../actions/submitMarketNewsDigestAction');
                const r = await submitMarketNewsDigestAction('crypto', 'ko');

                expect(r.status).toBe(status);
                expect(releaseMarketNewsDigestSlot).toHaveBeenCalledWith(
                    'crypto',
                    'ko'
                );
                expect(writeLatestMarketNewsDigest).not.toHaveBeenCalled();
            }
        );

        it.each([
            { status: 'done', result: DIGEST },
            { status: 'cached', result: DIGEST },
        ] as const)(
            '슬롯을 잡은 호출이 $status로 끝나면 슬롯을 유지한다',
            async result => {
                vi.mocked(core.runMarketNewsDigest).mockResolvedValue(
                    result as never
                );

                const { submitMarketNewsDigestAction } =
                    await import('../actions/submitMarketNewsDigestAction');
                await submitMarketNewsDigestAction('crypto', 'ko');

                expect(releaseMarketNewsDigestSlot).not.toHaveBeenCalled();
            }
        );

        it('남이 잡은 슬롯(콜드 스타트 생성)은 실패해도 돌려주지 않는다', async () => {
            vi.mocked(tryAcquireMarketNewsDigestSlot).mockResolvedValue(false);
            vi.mocked(core.runMarketNewsDigest).mockRejectedValue(
                new Error('llm down')
            );

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r.status).toBe('error');
            expect(releaseMarketNewsDigestSlot).not.toHaveBeenCalled();
        });

        it('기사가 0건이면 peek·슬롯 없이 core로 넘긴다(no_news는 LLM을 부르지 않는다)', async () => {
            vi.mocked(getMarketNewsList).mockResolvedValueOnce([]);
            vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
                status: 'no_news',
            });

            const { submitMarketNewsDigestAction } =
                await import('../actions/submitMarketNewsDigestAction');
            const r = await submitMarketNewsDigestAction('crypto', 'ko');

            expect(r.status).toBe('no_news');
            expect(core.peekMarketNewsDigestCache).not.toHaveBeenCalled();
            expect(tryAcquireMarketNewsDigestSlot).not.toHaveBeenCalled();
        });
    });
});
