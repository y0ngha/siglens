// 1. vi.mock 선언 — Vitest가 정적 import 전에 호이스팅한다.

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/api/isBot', () => ({ isBot: vi.fn(() => false) }));

// runMarketNewsDigest만 스텁하고 나머지 core 모듈은 원본을 유지한다.
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    runMarketNewsDigest: vi.fn(),
}));

// getMarketNewsList는 enriched row 형태의 최소 픽스처를 반환한다.
vi.mock('../api', () => ({
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
vi.mock('@/entities/news-article', async orig => ({
    ...(await orig()),
    isEnrichedRow: vi.fn(() => true),
    toEnrichedNewsItem: vi.fn((row: unknown) => row),
    selectAggregateNewsItems: vi.fn((items: unknown[]) => items),
}));

// 2. 정적 import — vi.mock 선언 이후에 배치한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBot } from '@/shared/api/isBot';
import * as core from '@y0ngha/siglens-core';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';

// 3. 테스트

describe('submitMarketNewsDigestAction은', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('봇이면 skipEnqueueIfMiss=true로 core를 호출한다', async () => {
        vi.mocked(isBot).mockReturnValue(true);
        vi.mocked(core.runMarketNewsDigest).mockResolvedValue({
            status: 'miss_no_trigger',
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        await submitMarketNewsDigestAction('crypto');

        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({
                skipEnqueueIfMiss: true,
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
        const r = await submitMarketNewsDigestAction('crypto');

        // 결과가 core의 반환값을 그대로 전달한다.
        expect(r.status).toBe('done');
        // 사람 경로에서 enqueue를 차단하면 안 된다.
        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    it('추론을 켜고 DeepSeek 기본 모델로 core를 호출한다', async () => {
        // `reasoning: true`는 모델 스펙을 오버라이드한다 — 스펙상 non-thinking인
        // deepseek-v4-flash에서도 추론이 켜져야 Gemini 시절 동작(spec
        // thinkingBudget 8192 = 추론 ON)과 같은 깊이가 유지된다. 이 단언이
        // 없으면 모델만 갈아끼웠을 때 다이제스트 추론이 조용히 꺼진다.
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
        await submitMarketNewsDigestAction('crypto');

        expect(core.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({
                reasoning: true,
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
        const r = await submitMarketNewsDigestAction('crypto');

        expect(r.status).toBe('cached');
    });

    it('예외 발생 시 throw하지 않고 error 상태를 반환한다', async () => {
        vi.mocked(core.runMarketNewsDigest).mockRejectedValue(
            new Error('core error')
        );

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto');

        expect(r.status).toBe('error');
        expect((r as { status: 'error'; error: string }).error).toBe(
            'Failed to submit digest'
        );
    });

    it('알 수 없는 카테고리는 core 호출 없이 error 상태를 반환한다', async () => {
        // TypeScript 타입 경계 밖의 값 — 런타임 직렬화(SSE 파라미터 등)에서 발생할 수 있다.
        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction(
            'unknown_category' as unknown as import('@y0ngha/siglens-core').NewsFeedCategory
        );

        expect(r.status).toBe('error');
        // CATEGORY_CONFIG에 없는 키이므로 core가 호출되어서는 안 된다.
        expect(core.runMarketNewsDigest).not.toHaveBeenCalled();
    });
});
